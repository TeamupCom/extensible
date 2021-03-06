/**
 * This is the scrolling container within the day and week views where non-all-day events are displayed.
 * Normally you should not need to use this class directly -- instead you should use {@link
 * Extensible.calendar.view.Day DayView} which aggregates this class and the {@link
 * Extensible.calendar.view.DayHeader DayHeaderView} into the single unified view
 * presented by {@link Extensible.calendar.CalendarPanel CalendarPanel}.
 */
Ext.define('Extensible.calendar.view.DayBody', {
    extend: 'Extensible.calendar.view.AbstractCalendar',
    alias: 'widget.extensible.daybodyview',

    requires: [
        'Ext.XTemplate',
        'Extensible.calendar.template.DayBody',
        'Extensible.calendar.data.EventMappings',
        'Extensible.calendar.dd.DayDragZone',
        'Extensible.calendar.dd.DayDropZone'
    ],

    dayColumnElIdDelimiter: '-day-col-',
    hourIncrement: 60,

    /**
     * @cfg {String} dragZoneClass
     * Class to be used as the view's drag zone implementation.
     */
    dragZoneClass: 'Extensible.calendar.dd.DayDragZone',

    /**
     * @cfg {String} dropZoneClass
     * Class to be used as the view's drop zone implementation.
     */
    dropZoneClass: 'Extensible.calendar.dd.DayDropZone',

    initComponent: function() {
        this.callParent(arguments);

        if(this.readOnly === true) {
            this.enableEventResize = false;
        }
        this.incrementsPerHour = this.hourIncrement / this.ddIncrement;
        this.minEventHeight = this.minEventDisplayMinutes / (this.hourIncrement / this.hourHeight);

        this.addEvents({
            /**
             * @event beforeeventresize
             * Fires after the user drags the resize handle of an event to resize it, but before the resize
             * operation is carried out. This is a cancelable event, so returning false from a handler will
             * cancel the resize operation.
             * @param {Extensible.calendar.view.DayBody} this
             * @param {Extensible.calendar.data.EventModel} rec The original {@link
             * Extensible.calendar.data.EventModel record} for the event that was resized
             * @param {Object} data An object containing the new start and end dates that will be set into the
             * event record if the event is not canceled. Format of the object is: {StartDate: [date], EndDate: [date]}
             */
            beforeeventresize: true,
            /**
             * @event eventresize
             * Fires after the user has drag-dropped the resize handle of an event and the resize operation is
             * complete. If you need to cancel the resize operation you should handle the {@link #beforeeventresize}
             * event and return false from your handler function.
             * @param {Extensible.calendar.view.DayBody} this
             * @param {Extensible.calendar.data.EventModel} rec The {@link Extensible.calendar.data.EventModel
             * record} for the event that was resized containing the updated start and end dates
             */
            eventresize: true,
            /**
             * @event dayclick
             * Fires after the user clicks within the view container and not on an event element. This is a
             * cancelable event, so returning false from a handler will cancel the click without displaying the event
             * editor view. This could be useful for validating that a user can only create events on certain days.
             * @param {Extensible.calendar.view.DayBody} this
             * @param {Date} dt The date/time that was clicked on
             * @param {Boolean} allday True if the day clicked on represents an all-day box, else false. Clicks
             * within the DayBodyView always return false for this param.
             * @param {Ext.Element} el The Element that was clicked on
             */
            dayclick: true
        });
    },

    initDD: function() {
        var cfg = {
            view: this,
            createText: this.ddCreateEventText,
            copyText: this.ddCopyEventText,
            moveText: this.ddMoveEventText,
            resizeText: this.ddResizeEventText,
            ddIncrement: this.ddIncrement,
            ddGroup: this.ddGroup || this.id + '-ddGroup'
        };

        this.el.ddScrollConfig = {
            // scrolling is buggy in IE/Opera for some reason.  A larger vthresh
            // makes it at least functional if not perfect
            vthresh: Ext.isIE || Ext.isOpera ? 100 : 40,
            hthresh: -1,
            frequency: 50,
            increment: 100,
            ddGroup: this.ddGroup || this.id + '-ddGroup'
        };

        this.dragZone = Ext.create(this.dragZoneClass, this.el, Ext.apply({
            // disabled for now because of bugs in Ext 4 ScrollManager:
            //containerScroll: true
        }, cfg));

        this.dropZone = Ext.create(this.dropZoneClass, this.el, cfg);
    },

    refresh: function(reloadData) {
        Extensible.log('refresh (' + Ext.getClassName(this) + '), reload = ' + reloadData);
        var top = this.el.getScroll().top;

        this.callParent(arguments);

        // skip this if the initial render scroll position has not yet been set.
        // necessary since IE/Opera must be deferred, so the first refresh will
        // override the initial position by default and always set it to 0.
        if(this.scrollReady) {
            this.scrollTo(top);
        }
    },

    /**
     * Scrolls the container to the specified vertical position. If the view is large enough that
     * there is no scroll overflow then this method will have no affect.
     * @param {Number} y The new vertical scroll position in pixels
     * @param {Boolean} defer (optional) True to slightly defer the call, false to execute immediately.
     *
     * This method will automatically defer itself for IE and Opera (even if you pass false) otherwise
     * the scroll position will not update in those browsers. You can optionally pass true, however, to
     * force the defer in all browsers, or use your own custom conditions to determine whether this is needed.
     *
     * Note that this method should not generally need to be called directly as scroll position is
     * managed internally.
     */
    scrollTo: function(y, defer) {
        defer = defer || (Ext.isIE || Ext.isOpera);
        if(defer) {
            Ext.defer(function() {
                this.el.scrollTo('top', y);
                this.scrollReady = true;
            }, 10, this);
        }
        else{
            this.el.scrollTo('top', y);
            this.scrollReady = true;
        }
    },

    afterRender: function() {
        if(!this.tpl) {
            this.tpl = Ext.create('Extensible.calendar.template.DayBody', {
                id: this.id,
                dayCount: this.dayCount,
                showTodayText: this.showTodayText,
                todayText: this.todayText,
                showTime: this.showTime,
                showHourSeparator: this.showHourSeparator,
                viewStartHour: this.viewStartHour,
                viewEndHour: this.viewEndHour,
                hourIncrement: this.hourIncrement,
                hourHeight: this.hourHeight
            });
        }

        this.addCls('ext-cal-body-ct');

        this.callParent(arguments);

        // default scroll position to scrollStartHour (7am by default) or min view hour if later
        var startHour = Math.max(this.scrollStartHour, this.viewStartHour),
            scrollStart = Math.max(0, startHour - this.viewStartHour);

        if(scrollStart > 0) {
            this.scrollTo(scrollStart * this.hourHeight);
        }
    },

    forceSize: Ext.emptyFn,

    // called from DayViewDropZone
    onEventResize: function(rec, data) {
        var me = this,
            EventMappings = Extensible.calendar.data.EventMappings,
            compareFn = Extensible.Date.compare;

        if (compareFn(rec.getStartDate(), data[EventMappings.StartDate.name]) === 0 &&
            compareFn(rec.getEndDate(), data[EventMappings.EndDate.name]) === 0) {
            // no changes
            return;
        }

        if (me.fireEvent('beforeeventresize', me, rec, data) !== false) {
            if (rec.isRecurring()) {
                if (me.recurrenceOptions.editSingleOnResize) {
                    me.onRecurrenceResizeModeSelected('single', rec, data);
                }
                else {
                    this.rangeEditWin = this.rangeEditWin || Ext.WindowMgr.get('ext-cal-rangeeditwin');
                    if (!this.rangeEditWin) {
                        this.rangeEditWin = new Extensible.form.recurrence.RangeEditWindow();
                    }
                    this.rangeEditWin.prompt({
                        callback: Ext.bind(me.onRecurrenceResizeModeSelected, me, [rec, data], true),
                        scope: me
                    });
                }
            }
            else {
                me.doEventResize(rec, data);
            }
        }
    },

    onRecurrenceResizeModeSelected: function(editMode, rec, data) {
        var EventMappings = Extensible.calendar.data.EventMappings;

        if (editMode) {
            rec.data[EventMappings.REditMode.name] = editMode;
            rec.data[EventMappings.RInstanceStartDate.name] = rec.getStartDate();
            this.doEventResize(rec, data);
        }
        // else user canceled
    },

    doEventResize: function(rec, data) {
        var EventMappings = Extensible.calendar.data.EventMappings,
            startDateName = EventMappings.StartDate.name,
            endDateName = EventMappings.EndDate.name,
            updateData = {};

        updateData[startDateName] = data[startDateName];
        updateData[endDateName] = data[endDateName];
        
        if (EventMappings.Duration) {
            updateData[EventMappings.Duration.name] = Extensible.Date.diff(data[startDateName], data[endDateName],
                Extensible.calendar.data.EventModel.resolution);
        }

        rec.set(updateData);

        this.save();

        this.fireEvent('eventupdate', this, rec);
        this.fireEvent('eventresize', this, rec);
    },

    /**
     * @protected 
     */
    getEventBodyMarkup: function() {
        if(!this.eventBodyMarkup) {
            this.eventBodyMarkup = ['{Title}',
                '<tpl if="_isReminder">',
                    '<i class="ext-cal-ic ext-cal-ic-rem">&#160;</i>',
                '</tpl>',
                '<tpl if="_isRecurring">',
                    '<i class="ext-cal-ic ext-cal-ic-rcr">&#160;</i>',
                '</tpl>'
//                '<tpl if="spanLeft">',
//                    '<i class="ext-cal-spl">&#160;</i>',
//                '</tpl>',
//                '<tpl if="spanRight">',
//                    '<i class="ext-cal-spr">&#160;</i>',
//                '</tpl>'
            ].join('');
        }
        return this.eventBodyMarkup;
    },

    /**
     * @protected 
     */
    getEventTemplate: function() {
        if(!this.eventTpl) {
            this.eventTpl = !(Ext.isIE || Ext.isOpera) ?
                Ext.create('Ext.XTemplate',
                    '<div id="{_elId}" class="{_extraCls} ext-cal-evt ext-cal-evr" ',
                            'style="left: {_left}%; width: {_width}%; top: {_top}px; height: {_height}px;">',
                        '<div class="ext-evt-bd">', this.getEventBodyMarkup(), '</div>',
                        this.enableEventResize ?
                            '<div class="ext-evt-rsz"><div class="ext-evt-rsz-h">&#160;</div></div>' : '',
                    '</div>'
                )
                : Ext.create('Ext.XTemplate',
                    '<div id="{_elId}" class="ext-cal-evt {_extraCls}" ',
                            'style="left: {_left}%; width: {_width}%; top: {_top}px;">',
                        '<div class="ext-cal-evb">&#160;</div>',
                        '<dl style="height: {_height}px;" class="ext-cal-evdm">',
                            '<dd class="ext-evt-bd">',
                                this.getEventBodyMarkup(),
                            '</dd>',
                            this.enableEventResize ?
                                '<div class="ext-evt-rsz"><div class="ext-evt-rsz-h">&#160;</div></div>' : '',
                        '</dl>',
                        '<div class="ext-cal-evb">&#160;</div>',
                    '</div>'
                );
            this.eventTpl.compile();
        }
        return this.eventTpl;
    },

    /**
     * Returns the XTemplate that is bound to the calendar's event store (it expects records of type
     * {@link Extensible.calendar.data.EventModel}) to populate the calendar views with **all-day** events.
     * Internally this method by default generates different markup for browsers that support CSS border radius
     * and those that don't. This method can be overridden as needed to customize the markup generated.
     * 
     * Note that this method calls {@link #getEventBodyMarkup} to retrieve the body markup for events separately
     * from the surrounding container markup.  This provdes the flexibility to customize what's in the body without
     * having to override the entire XTemplate. If you do override this method, you should make sure that your
     * overridden version also does the same.
     * @return {Ext.XTemplate} The event XTemplate
     */
    getEventAllDayTemplate: function() {
        if(!this.eventAllDayTpl) {
            var tpl, body = this.getEventBodyMarkup();

            tpl = !(Ext.isIE || Ext.isOpera) ?
                Ext.create('Ext.XTemplate',
                    '<div class="{_extraCls} {spanCls} ext-cal-evt ext-cal-evr" ',
                            'style="left: {_left}%; width: {_width}%; top: {_top}px; height: {_height}px;">',
                        body,
                    '</div>'
                )
                : Ext.create('Ext.XTemplate',
                    '<div class="ext-cal-evt" ',
                            'style="left: {_left}%; width: {_width}%; top: {_top}px; height: {_height}px;">',
                        '<div class="{_extraCls} {spanCls} ext-cal-evo">',
                            '<div class="ext-cal-evm">',
                                '<div class="ext-cal-evi">',
                                    body,
                                '</div>',
                            '</div>',
                        '</div>',
                    '</div>'
                );
            tpl.compile();
            this.eventAllDayTpl = tpl;
        }
        return this.eventAllDayTpl;
    },

    getTemplateEventData: function(evtData) {
        var M = Extensible.calendar.data.EventMappings,
            extraClasses = [this.getEventSelectorCls(evtData[M.EventId.name])],
            data = {},
            colorCls = 'x-cal-default',
            title = evtData[M.Title.name],
            fmt = Extensible.Date.use24HourTime ? 'G:i ' : 'g:ia ',
            rec;

        this.getTemplateEventBox(evtData);

        if(this.calendarStore && evtData[M.CalendarId.name]) {
            rec = this.calendarStore.findRecord(Extensible.calendar.data.CalendarMappings.CalendarId.name,
                evtData[M.CalendarId.name]);

            if (rec) {
                colorCls = 'x-cal-' + rec.data[Extensible.calendar.data.CalendarMappings.ColorId.name];
            }
        }
        colorCls += (evtData._renderAsAllDay ? '-ad' : '') + (Ext.isIE || Ext.isOpera ? '-x' : '');
        extraClasses.push(colorCls);

        extraClasses.push('ext-evt-block');

        if(this.getEventClass) {
            rec = this.getEventRecord(evtData[M.EventId.name]);
            var cls = this.getEventClass(rec, !!evtData._renderAsAllDay, data, this.store);
            extraClasses.push(cls);
        }

        data._extraCls = extraClasses.join(' ');
        data._isRecurring = M.RRule && evtData[M.RRule.name] && evtData[M.RRule.name] !== '';
        data._isReminder = evtData[M.Reminder.name] && evtData[M.Reminder.name] !== '';
        data.Title = (evtData[M.IsAllDay.name] ? '' : Ext.Date.format(evtData[M.StartDate.name], fmt)) +
                (!title || title.length === 0 ? this.defaultEventTitleText : title);

        return Ext.applyIf(data, evtData);
    },

    getEventPositionOffsets: function() {
        return {
            top: 0,
            height: -1
        };
    },

    getTemplateEventBox: function(evtData) {
        var heightFactor = this.hourHeight / this.hourIncrement,
            start = evtData[Extensible.calendar.data.EventMappings.StartDate.name],
            end = evtData[Extensible.calendar.data.EventMappings.EndDate.name],
            startOffset = Math.max(start.getHours() - this.viewStartHour, 0),
            endOffset = Math.min(end.getHours() - this.viewStartHour, this.viewEndHour - this.viewStartHour),
            startMins = startOffset * this.hourIncrement,
            endMins = endOffset * this.hourIncrement,
            viewEndDt = Extensible.Date.add(Ext.Date.clone(end), {hours: this.viewEndHour, clearTime: true}),
            evtOffsets = this.getEventPositionOffsets();

        if(start.getHours() >= this.viewStartHour) {
            // only add the minutes if the start is visible, otherwise it offsets the event incorrectly
            startMins += start.getMinutes();
        }
        if(end <= viewEndDt) {
            // only add the minutes if the end is visible, otherwise it offsets the event incorrectly
            endMins += end.getMinutes();
        }

        evtData._left = 0;
        evtData._width = 100;
        evtData._top = startMins * heightFactor + evtOffsets.top;
        evtData._height = Math.max(((endMins - startMins) * heightFactor), this.minEventHeight) + evtOffsets.height;
    },

    /**
     * Render events.
     * The event layout is based on this article: http://stackoverflow.com/questions/11311410/ and this sample
     * implementation http://jsbin.com/detefuveta/5/edit?html,js,output     *
     */
    renderItems: function() {
        var evts = [];

        evts = this.filterEventsToRender();
        this.layoutAndRenderItems(evts);
        this.fireEvent('eventsrendered', this);
     },

    /**
     * Filters events and returns a list of events that need to be displayed by the day body view.
     * For example, all-day events and multi-day events are filtered out because they are not
     * displayed in the body.
     * This is a private helper function.
     * @protected
     * @returns {Array} An array of events.
     */
    filterEventsToRender: function() {
        var evt,
            evts = [],
            M = Extensible.calendar.data.EventMappings;

        for (var day = 0; day < this.dayCount; day++) {
            var ev = 0,
                emptyCells = 0,
                skipped = 0,
                d = this.eventGrid[0][day],
                ct = d ? d.length : 0;

            for (; ev < ct; ev++) {
                evt = d[ev];
                if(!evt) {
                    continue;
                }
                var item = evt.data || evt.event.data,
                    ad = item[M.IsAllDay.name] === true,
                    span = this.isEventSpanning(evt.event || evt),
                    renderAsAllDay = ad || span;

                if(renderAsAllDay) {
                    // this event is already rendered in the header view
                    continue;
                }
                Ext.apply(item, {
                    cls: 'ext-cal-ev',
                    _positioned: true
                });
                evts.push({
                    data: this.getTemplateEventData(item),
                    date: Extensible.Date.add(this.viewStart, {days: day})
                });
            }
        }

        return evts;
    },

    /**
     * Layout events and render to DOM.
     * @protected
     * @param {Array} events An array of events.
     */
    layoutAndRenderItems: function(evts) {
        // Layout events
        var i = 0,
            j = 0,
            l = evts.length,
            evt,
            minEventDuration = (this.minEventDisplayMinutes || 0) * 60 * 1000,
            lastEventEnding = 0,
            columns = [], // virtual columns for placement of the events
            eventGroups = [],
            M = Extensible.calendar.data.EventMappings;

        for(i=0; i<l; i++){
            evt =  evts[i];
            if (lastEventEnding !== 0 && evt.data[M.StartDate.name].getTime() >= lastEventEnding) {
                // This event does not overlap with the current event group. Start a new event group.
                eventGroups.push(columns);
                columns = [];
                lastEventEnding = 0;
            }
            var placed = false;

            for (j = 0; j < columns.length; j++) {
                var col = columns[ j ];
                if (!this.isOverlapping( col[col.length-1], evt ) ) {
                    col.push(evt);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                columns.push([evt]);
            }

            // Remember the last event time of the event group.
            // Very short events have a minimum duration on screen (we can't see a one minute event).
            var eventDuration = evt.data[M.EndDate.name].getTime() - evt.data[M.StartDate.name].getTime();
            var eventEnding;
            if (eventDuration < minEventDuration) {
                eventEnding = evt.data[M.StartDate.name].getTime() + minEventDuration;
            } else {
                eventEnding = evt.data[M.EndDate.name].getTime();
            }
            if (eventEnding > lastEventEnding) {
                lastEventEnding = eventEnding;
            }
        }

        // Push the last event group, if there is one.
        if(columns.length > 0){
            eventGroups.push(columns);
        }

        // Rendering loop
        l = eventGroups.length;
        // Loop over all the event groups.
        for (i = 0; i < l; i++) {
            var evtGroup = eventGroups[i];
            var numColumns = evtGroup.length;

            // Loop over all the virtual columns of an event group
            for (j = 0; j < numColumns; j++) {
                col = evtGroup[j];

                // Loop over all the events of a virtual column
                for (var k = 0; k < col.length; k++) {
                    evt = col[k];

                    // Check if event is rightmost of a group and can be expanded to the right
                    var colSpan = this.expandEvent(evt, j, evtGroup);

                    evt.data._width = (100 * colSpan / numColumns);
                    evt.data._left = (j / numColumns) * 100;
                    var markup = this.getEventTemplate().apply(evt.data),
                        target = this.getDayId(evt.date, null, evt.data.CalendarId);
                    Ext.DomHelper.append(target, markup);
                }
            }
        }
    },

    /**
     * Expand events at the far right to use up any remaining space. This implements step 5 in the layout
     * algorithm described here: http://stackoverflow.com/questions/11311410/
     * @private
     * @param {Object} evt Event to process.
     * @param {int} iColumn Virtual column to where the event will be rendered.
     * @param {Array} columns List of virtual colums for event group. Each column contains a list of events.
     * @return {Number}
     */
    expandEvent: function(evt, iColumn, columns) {
        var colSpan = 1;

        // To see the output without event expansion, uncomment
        // the line below. Watch column 3 in the output.
        // return colSpan;

        for (var i = iColumn + 1; i < columns.length; i++)
        {
            var col = columns[i];
            for (var j = 0; j < col.length; j++)
            {
                var evt1 = col[j];
                if (this.isOverlapping(evt, evt1))
                {
                    return colSpan;
                }
            }
            colSpan++;
        }
        return colSpan;
    },

    getDayEl: function(dt) {
        return Ext.get(this.getDayId(dt));
    },

    getDayId: function(dt) {
        if(Ext.isDate(dt)) {
            dt = Ext.Date.format(dt, 'Ymd');
        }
        return this.id + this.dayColumnElIdDelimiter + dt;
    },

    getDaySize: function() {
        var box = this.el.down('.ext-cal-day-col-inner').getBox();
        return {height: box.height, width: box.width};
    },

    getDayAt: function(x, y) {
        var sel = '.ext-cal-body-ct',
            xoffset = this.el.down('.ext-cal-day-times').getWidth(),
            viewBox = this.el.getBox(),
            daySize = this.getDaySize(false),
            relX = x - viewBox.x - xoffset,
            dayIndex = Math.floor(relX / daySize.width), // clicked col index
            scroll = this.el.getScroll(),
            row = this.el.down('.ext-cal-bg-row'), // first avail row, just to calc size
            rowH = row.getHeight() / this.incrementsPerHour,
            relY = y - viewBox.y - rowH + scroll.top,
            rowIndex = Math.max(0, Math.ceil(relY / rowH)),
            mins = rowIndex * (this.hourIncrement / this.incrementsPerHour),
            dt = Extensible.Date.add(this.viewStart, {days: dayIndex, minutes: mins, hours: this.viewStartHour}),
            el = this.getDayEl(dt),
            timeX = x;

        if(el) {
            timeX = el.getLeft();
        }

        return {
            date: dt,
            el: el,
            // this is the box for the specific time block in the day that was clicked on:
            timeBox: {
                x: timeX,
                y: (rowIndex * this.hourHeight / this.incrementsPerHour) + viewBox.y - scroll.top,
                width: daySize.width,
                height: rowH
            }
        };
    },

    onClick: function(e, t) {
        if(this.dragPending || Extensible.calendar.view.DayBody.superclass.onClick.apply(this, arguments)) {
            // The superclass handled the click already so exit
            return;
        }
        if(e.getTarget('.ext-cal-day-times', 3) !== null) {
            // ignore clicks on the times-of-day gutter
            return;
        }
        var el = e.getTarget('td', 3);
        if(el) {
            if(el.id && el.id.indexOf(this.dayElIdDelimiter) > -1) {
                alert('DayBody.onClick unknown case!!');
                var dt = this.getDateFromId(el.id, this.dayElIdDelimiter);
                this.onDayClick(Ext.Date.parseDate(dt, 'Ymd'), true, Ext.get(this.getDayId(dt)));
                return;
            }
        }
        var day = this.getDayAt(e.getX(), e.getY());
        if(day && day.date) {
            this.onDayClick(day.date, false, null);
        }
    },

    /**
     * @protected 
     */
    isActiveView: function() {
        var calendarPanel = this.ownerCalendarPanel;
        return (calendarPanel && calendarPanel.getActiveView().isDayView);
    }
});