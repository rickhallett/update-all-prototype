/*globals $*/
/*globals _*/
/*
 * A plugin that displays a custom tooltip on any element below
 * with the class 'customtip'.
 *
 * It places single div in the body for displaying all tooltips used by this plugin.
 */

(function ($) {
    'use strict';

    function isEllipsisActive(e) {
        return e.offsetWidth < e.scrollWidth;
    }

    function hideCustomtips($targetElement) {
        $targetElement
            .find('.customtip')
            .addBack('.customtip')
            .each(function () {
                var api = $(this).data('tooltip');

                if (!api) {
                    return; //no tooltip to remove
                }

                api.hide();
            });

        return $targetElement;
    }

    function disableCustomtips($this, value) {
        let tipElements = $this.find('.customtip');
        tipElements.push(...$this.filter('.customtip').toArray());

        tipElements.data('tooltip-disabled', value);
    }

    $.fn.customtip = function (opts) {
        if (opts === 'hide') {
            return hideCustomtips($(this));
        }

        if (opts === 'disable') {
            return disableCustomtips($(this), true);
        }

        if (opts === 'enable') {
            return disableCustomtips($(this), false);
        }

        opts = opts || {};
        var optsPosition = opts.position,
            tipElements,
            arrowHeight = 6, //px
            arrowWidth = 10, //px, these must be consistent with customtip.css
            configMap;

        delete opts.position;

        // maps customTip positions ("top", "bottom", "left", "right") to jquery.tooltip positions ([x, y]) and
        // arrow offsets, calculated dynamically depending on the size of the target element
        configMap = {
            top: {
                position: 'top center',
                tipClass: 'tip-top',
                arrowTop: function (height) {
                    return height - 1;
                },
                arrowLeft: function (width) {
                    return (width - arrowWidth) / 2;
                },
            },
            bottom: {
                position: 'bottom center',
                tipClass: 'tip-bottom',
                arrowTop: function () {
                    return -arrowHeight + 1;
                },
                arrowLeft: function (width) {
                    return (width - arrowWidth) / 2;
                },
            },
            left: {
                position: 'center left',
                tipClass: 'tip-right',
                arrowTop: function (height) {
                    return (height - arrowWidth) / 2;
                },
                arrowLeft: function (width) {
                    return width - 1;
                },
            },
            right: {
                position: 'center right',
                tipClass: 'tip-left',
                arrowTop: function (height) {
                    return (height - arrowWidth) / 2;
                },
                arrowLeft: function () {
                    return -arrowHeight + 1;
                },
            },
            'top-left': {
                position: 'top left',
                tipClass: 'tip-top',
                arrowTop: function (height) {
                    return height - 1;
                },
                arrowLeft: function (width) {
                    return width - arrowWidth - 2;
                },
                alignRight: true,
            },
        };

        return this.each(function () {
            var $this = $(this),
                $el = $('#customtip'),
                $arrow = $('<span id="customtip-arrow"></span>'),
                oldBeforeShow,
                oldOnShow;

            if (!$el.length) {
                $el = $('<div id="customtip" class="tooltip"/>').hide();
                $el.mouseover(function () {
                    $el.hide();
                });
                $('body').on('click.customtip', function () {
                    $el.hide();
                });
                $el.appendTo('body');
            }

            tipElements = $this.find('.customtip');
            if ($this.hasClass('customtip')) {
                tipElements.push(this);
            }

            tipElements.each(function () {
                var $targetEl = $(this),
                    options,
                    tooltipConfig,
                    title = $targetEl.attr('title'),
                    tipPosition =
                        $targetEl.data('tip-position') || optsPosition;

                $targetEl.data('tooltip-disabled', false);

                // need to clear the tooltip data on the current element,
                // else the tooltip plugin will neither refresh itself
                // nor any tooltips in child elements
                $targetEl.removeData('tooltip');

                if (title && !$targetEl.hasClass('customtip-html')) {
                    // HTML-Escape tooltip text to prevent XSS
                    $targetEl.attr('title', _.escape(title));
                }

                tooltipConfig =
                    configMap[
                        configMap.hasOwnProperty(tipPosition)
                            ? tipPosition
                            : 'top'
                    ]; //default position is top

                if (opts.tipHigh) {
                    tooltipConfig.tipHighClass = 'tip-high';
                }

                options = _.extend(
                    {
                        position: tooltipConfig.position,
                        tip: $el,
                        delay: 0, // If there is a delay, then going straight from one tip to
                        // another will hide the next tip after the delay
                        predelay: 150,
                        events: {
                            input: 'mouseover, mouseout',
                        },
                        tipClass: `${tooltipConfig.tipClass} ${tooltipConfig.tipHighClass}`,
                        offset: [
                            0,
                            tooltipConfig.alignRight
                                ? $targetEl.outerWidth()
                                : 0,
                        ],
                    },
                    opts
                );

                oldBeforeShow = options.onBeforeShow;
                options.onBeforeShow = function (e) {
                    if ($targetEl.data('tooltip-disabled')) {
                        return e.preventDefault();
                    }

                    var $target = $(e.target);
                    this.getTip().hide().css({ top: 0, left: 0 }); //allows the tooltip to be sized and positioned correctly

                    // don't show tooltip if ellipsis is not active
                    if (
                        $target.hasClass('ellipsistooltip') &&
                        !isEllipsisActive(e.target)
                    ) {
                        return false;
                    }
                    // adjust tooltip class before show
                    $el.removeClass().addClass('tooltip ' + options.tipClass);
                    $arrow.css({
                        top: tooltipConfig.arrowTop($el.outerHeight()) + 'px',
                        left: tooltipConfig.arrowLeft($el.outerWidth()) + 'px',
                    });

                    $el.wrapInner('<div class="tooltip__content-wrapper" />');

                    $arrow
                        .removeClass()
                        .addClass(
                            `tip-arrow ${tooltipConfig.tipClass}-arrow ${tooltipConfig.tipHighClass}`
                        )
                        .appendTo($el);

                    if (oldBeforeShow) {
                        return oldBeforeShow.apply(this, arguments);
                    }
                    return true;
                };

                // When the plugin moves the tooltip to its correct position it may cause linebreaks when
                // there is not enough horizontal space. The additional line(s) will overlay the tip-arrow
                // *if* the tip is in one of the "top" positions. Fix the arrow position here:
                oldOnShow = options.onShow;
                options.onShow = function () {
                    var newArrowTop = tooltipConfig.arrowTop($el.outerHeight()),
                        actualArrowTop = $arrow.position().top,
                        gap = newArrowTop - actualArrowTop;

                    if (tooltipConfig.position.indexOf('top') > -1 && gap) {
                        // fix gap between tip and arrow
                        $arrow.css('top', newArrowTop + 'px');
                        // move tip up to account for gap
                        $el.css('top', $el.position().top - gap + 'px');
                    }

                    if (oldOnShow) {
                        return oldOnShow.apply(this, arguments);
                    }
                    return true;
                };

                $targetEl.tooltip(options);
            });
        });
    };
})($);
