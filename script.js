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
var NUM_DAYS = 14; // Number of days to show on activity graph. We recalculate this on orientation change.
var forEach = Array.prototype.forEach;

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
    window.displayError = message;
    console.error(message);
}
function handleAbort() {
    handleError('Request aborted.');
}
function handleLoad(response) {
    var status = response.currentTarget.status;
    var json = JSON.parse(response.currentTarget.responseText);
    console.debug("handleLoad",json);
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
    colorLegends();
    loaded();
}
function loaded() {
    window.displayLoaded = true;
    document.body.style.opacity = "1.0";
}
function normalizeJson(array) {
    var data = {meta:{now:new Date()}};

    var restructuredData = {};
    array.forEach(function(object) {
        var dateString = Object.keys(object)[0];
        restructuredData[dateString] = object[dateString];
    });

    // In reverse chronological order...
    var dateStrings = Object.keys(restructuredData).sort().reverse();
    data.meta.offset = (6 - new Date(dateStrings[0]).getDay());

    // Calendar values.
    data.calendar = dateStrings.map(function(dateString) {
        var dayOfData = restructuredData[dateString];
        var measures = [];
        GRAPH_IDS.forEach(function(graphId) {
            var preMeasure = dayOfData[graphId].pre;
            var postMeasure = dayOfData[graphId].post;
            measureToEntry(measures, preMeasure, COLORS[graphId].pre);
            measureToEntry(measures, postMeasure, COLORS[graphId].pre);
        });
        return measures.reverse();
    });

    var object = {};
    GRAPH_IDS.forEach(function(graphId) {
        object[graphId] = {pre:[], post:[], labels:[]};
    });
    dateStrings.forEach(function(dateString) {
        var thisDay = new Date(dateString);
        var thisDayString = (thisDay.getMonth()+1)+ "/" + (thisDay.getDate());
        GRAPH_IDS.forEach(function(graphId) {
            var dayOfData = restructuredData[dateString][graphId];
            var preMeasure = (dayOfData.pre === "NA") ? 0 : 100-(dayOfData.pre * 100);
            var postMeasure = (dayOfData.post === "NA") ? 0 : 100-(dayOfData.post * 100);
            object[graphId].pre.push(preMeasure);
            object[graphId].post.push(postMeasure);
            object[graphId].labels.push(thisDayString);
            object[graphId].controlMin = dayOfData.controlMin;
            object[graphId].controlMax = dayOfData.controlMax;
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
function renderCalendarGraph(json) {
    // We don't need today's offset, we need the most recent day of data's offset.
    var offset = json.meta.offset;

    json.calendar.forEach(function(data, i) {
        var ctx = el("c"+(offset+i)).getContext("2d");
        new Chart(ctx).Doughnut(data, {
            showTooltips:false,
            segmentShowStroke:true,
            animation:false,
            percentageInnerCutout: 30
        });
    });
}
function renderActivityGraph(json) {
    GRAPH_IDS.forEach(function(graphId, i) {
        var labels = json.activities[graphId].labels.slice(0,NUM_DAYS);
        var pre = json.activities[graphId].pre.slice(0,NUM_DAYS);
        var post = json.activities[graphId].post.slice(0,NUM_DAYS);
        var controlMin = json.activities[graphId].controlMin;
        var controlMax = json.activities[graphId].controlMax;
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
function colorLegends() {
    GRAPH_IDS.forEach(function(graphId) {
        forEach.call(document.body.querySelectorAll("."+graphId+"-pre"), function(el) {
            el.style.backgroundColor = COLORS[graphId].pre;
        });
        forEach.call(document.body.querySelectorAll("."+graphId+"-post"), function(el) {
            el.style.backgroundColor = COLORS[graphId].post;
        });
    });
}
function sizeSquare(canvas) {
    var width = (canvas.parentNode.clientWidth-10);
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

init(); // don't delete this even when moving to server data, it's needed.
displayGraph(testData);
document.body.style.opacity = "1.0"; // REMOVEME
