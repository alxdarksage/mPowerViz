if (document.location.hash === "#pdf") {
    document.body.classList.add("showpdf");
}

var COLORS = {
    empty: "#f4f4f4",
    tap: {
        pre: "#E9406A",
        post: "#F398AF"
    },
    gait: {
        pre: "#54ABCC",
        post: "#A7D3E7"
    },
    voice: {
        pre: "#EDB64F",
        post: "#F3D9A4"
    },
    balance: {
        pre: "#744696",
        post: "#B49CC6"
    }
};
var FOUR_WEEKS = 1000*60*60*24*30;
var ONE_DAY = 1000*60*60*24;
var GRAPH_IDS = ['tap','gait','voice','balance'];
var SLICE_PERC = 100/8; // The size of a piece of pie. 4 post/pre measures = 10 pie pieces
var NUM_DAYS; // Number of days to show on activity graph. We calculate this in init() (& on orientation change)
var MONTHS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function el(id) {
    return document.getElementById(id);
}
function nowISOString() {
    return new Date().toISOString().split("T")[0];
}
function fourWeeksAgoISOString() {
    return new Date(new Date().getTime()-FOUR_WEEKS).toISOString().split("T")[0];
}
function handleError(message) {
    alert(message);
}
function handleAbort() {
    handleError('Request aborted.');
}
function displayNoData() {
    el("loading").style.opacity = "0.0";
    el("content").style.opacity = "0.0";
    setTimeout(function() {
        el("content").style.display = "none";
        el("nodata").style.opacity = "1.0";    
    }, 500);
}
function handleLoad(response) {
    console.debug("handleLoad",response);
    
    var status = response.currentTarget.status;
    var text = response.currentTarget.responseText;
    if (text === "" || text === "{}" || text === "null") {
        displayNoData();
        return;
    }
    var json = JSON.parse(text);
    switch(status) {
        case 200:
            return displayGraph(json);
        case 412:
            return handleError("User has not consented to participate in study.");
        default:
            return handleError(json.message);
    }
}
function displayGraph(json) {
    console.debug("displayGraph",json);
    json = normalizeJson(json);
    window.data = json; // for reloads, hold this data in global scope
    renderCalendarGraph(json);
    renderActivityGraph(json);
    loaded();
}
function loaded() {
    el("nodata").style.opacity = "0.0";
    el("loading").style.opacity = "0.0";
    setTimeout(function() {
        el("content").style.height = "auto";
        el("content").style.opacity = "1.0";    
    }, 500);
}
function normalizeJson(response) {
    var data = {meta:{now:new Date()}};

    // In reverse chronological order...
    var dateStrings = Object.keys(response).sort().reverse();
    data.meta.offset = (6 - new Date(dateStrings[0]).getDay());

    // Calendar values.
    data.calendar = dateStrings.map(function(dateString) {
        var dayOfData = response[dateString];
        var measures = [];
        GRAPH_IDS.forEach(function(graphId) {
            var preMeasure = dayOfData[graphId].pre;
            var postMeasure = dayOfData[graphId].post;
            measureToEntry(measures, preMeasure, COLORS[graphId].pre);
            measureToEntry(measures, postMeasure, COLORS[graphId].pre);
        });
        return {
            data: measures.reverse(),
            date: dateString
        };
    });

    var object = {};
    GRAPH_IDS.forEach(function(graphId) {
        object[graphId] = {pre:[], post:[], labels:[]};
    });
    dateStrings.forEach(function(dateString) {
        var thisDay = new Date(dateString);
        var thisDayString = (thisDay.getMonth()+1)+ "/" + (thisDay.getDate());
        GRAPH_IDS.forEach(function(graphId) {
            var obj = object[graphId];
            var dayOfData = response[dateString][graphId];
            var preMeasure = (dayOfData.pre === "NA") ? 0 : 100-(dayOfData.pre * 100);
            var postMeasure = (dayOfData.post === "NA") ? 0 : 100-(dayOfData.post * 100);
            obj.pre.push(preMeasure);
            obj.post.push(postMeasure);
            obj.labels.push(thisDayString);
            obj.controlMin = dayOfData.controlMin;
            obj.controlMax = dayOfData.controlMax;
        });
    });
    data.activities = object;
    return data;
}
function measureToEntry(measures, value, color) {
    if (value !== "NA") {
        measures.push({value: SLICE_PERC, color:color});
    } else {
        measures.unshift({value: SLICE_PERC, color:COLORS.empty});
    }
}
function parseDateString(date) {
    var dateObj = new Date(date);
    var isoComponents = dateObj.toISOString().split("-");
    return {
        month: parseInt(isoComponents[1], 10),
        dayOfMonth: parseInt(isoComponents[2], 10),
        title: dateObj.toUTCString().replace("00:00:00 ","")
    };
}
function renderCalendarGraph(json) {
    // We don't need today's offset, we need the most recent day of data's offset.
    var offset = json.meta.offset;

    var lastMonth = null;
    json.calendar.forEach(function(data, i) {
        var canvas = el("c"+(offset+i-1));
        
        var comps = parseDateString(data.date);
        if (comps.month !== lastMonth || i === json.calendar.length-1) {
            canvas.nextSibling.textContent = (MONTHS[comps.month] + " " + comps.dayOfMonth);
        } else {
            canvas.nextSibling.textContent = comps.dayOfMonth;
        }
        lastMonth = comps.month;
        
        canvas.title = comps.title;
            
        var ctx = canvas.getContext("2d");
        new Chart(ctx).Doughnut(data.data, {
            showTooltips:false,
            segmentShowStroke:false,
            animation:false,
            percentageInnerCutout: 30
        });
    });
}
function renderActivityGraph(json) {
    GRAPH_IDS.forEach(function(graphId, i) {
        var activity = json.activities[graphId];
        var labels = activity.labels.slice(0,NUM_DAYS);
        var pre = activity.pre.slice(0,NUM_DAYS);
        var post = activity.post.slice(0,NUM_DAYS);
        var controlMin = activity.controlMin;
        var controlMax = activity.controlMax;
        var data = {labels: labels, datasets: [
            {fillColor: COLORS[graphId].pre, data: pre},
            {fillColor: COLORS[graphId].post, data: post}
        ]};
        var ctx = el(graphId).getContext("2d");
        new Chart(ctx).BarAlt(data, {
            controlMin: controlMin,
            controlMax: controlMax,
            scaleBeginAtZero: true,
            animation: false,
            barShowStroke: false,
            barValueSpacing: 1,
            barDatasetSpacing: 0,
            barStrokeWidth: 3,
            scaleShowLabels: false,
            scaleShowGridLines: false,
            scaleFontSize: 10,
            scaleLineWidth: 0,
            scaleLineColor: "rgba(0,0,0,0)",
            showTooltips: false
        });
    });
}
function sizeSquare(canvas) {
    var width = (canvas.parentNode.clientWidth-2);
    canvas.style.width = canvas.style.height = width + "px";
}
function sizeWidth(canvas) {
    var width = (canvas.parentNode.clientWidth-20);
    var height = (width/2.5) + ((document.body.clientWidth <= 360) ? 50 : 0);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
}
function iterateOverCanvases(selector, func) {
    var canvases = document.body.querySelectorAll(selector);
    for (var i=0; i < canvases.length; i++) {
        func(canvases[i]);
    }
}
function init() {
    NUM_DAYS = (document.body.clientWidth > 360) ? 30 : 14;
    iterateOverCanvases("#calendar canvas", sizeSquare);
    iterateOverCanvases("#activities canvas", sizeWidth);
}
Chart.types.Bar.extend({
    name: "BarAlt",
    draw: function(){
        var context = this.chart.ctx;

        // don't allow superclass to do this
        this.clear();
        this.clear = function() {};

        var offsetTop = this.scale.calculateY(100);
        var width = Math.floor(this.chart.canvas.scrollWidth);
        var height = Math.floor(this.chart.canvas.scrollHeight);
        var graphHeight = height - (height-this.scale.endPoint) - offsetTop;

        var minY = this.options.controlMin; //.25;
        var maxY = this.options.controlMax; // .75;

        // normal population range bar (light bar in background)
        var startY = offsetTop + (graphHeight-(graphHeight * maxY));
        var endY = graphHeight * (maxY-minY);
        context.fillStyle = "#eee";
        context.fillRect(0, startY, width, endY);

        // light bounding box
        context.beginPath();
        context.strokeWidth = 1;
        context.strokeStyle = '#eee';
        context.moveTo(0,offsetTop+graphHeight);
        context.lineTo(0,offsetTop-0.5);
        context.lineTo(width,offsetTop-0.5);
        context.lineTo(width,graphHeight+offsetTop);
        context.stroke();

        // bottom thick black bar
        context.fillStyle = "black";
        context.strokeWidth = 0;
        context.fillRect(0, offsetTop + graphHeight, width, 2);

        Chart.types.Bar.prototype.draw.apply(this, arguments);
    }
});
el("date").textContent = new Date().toLocaleDateString();

window.display = function(sessionToken, startDate, endDate) {
    if (sessionToken === "aaa") {
        displayGraph(testData);
        return;
    } else if (sessionToken === "bbb") {
        displayNoData();
        return;
    }
    
    startDate = startDate || fourWeeksAgoISOString();
    endDate = endDate || nowISOString();

    var url = 'https://webservices.sagebridge.org/parkinson/visualization' +
            '?startDate='+startDate+'&endDate='+endDate;

    console.info("Querying for ", startDate, "-", endDate);
    var request = new XMLHttpRequest();
    request.open('GET', url);
    request.setRequestHeader("Bridge-Session", sessionToken);
    request.addEventListener("abort", handleAbort);
    request.addEventListener("load", handleLoad);
    request.send();
}
window.onorientationchange = function() {
    init();
    displayGraph(testData);
};
init();
