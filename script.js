var FOUR_WEEKS = 1000*60*60*24*30;
var ONE_DAY = 1000*60*60*24;

document.body.style.opacity = "1.0";

var graphs = ['tapLeft','tapRight','walk','voice','balance'];
var sliceWidth = 100/10; // The size of a piece of pie. 5 post/pre measures = 10 pie pieces
var numDays = 14; // Number of days to show on activity graph. We recalculate this on orientation change.

var colors = {
    empty: "#f4f4f4",
    tapLeftPre: "#E9406A",
    tapLeftPost: "#F398AF",
    tapRightPre: "#58B561",
    tapRightPost: "#A9D7AA",
    walkPre: "#54ABCC",
    walkPost: "#A7D3E7",
    voicePre: "#EDB64F",
    voicePost: "#F3D9A4",
    balancePre: "#744696",
    balancePost: "#B49CC6"
    /* and two extra colors to burn
     tremorPre: "#58B561",
     tremorPost: "#A9D7AA",
     */
};
var colorKeys = Object.keys(colors);

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
    renderCalendarGraph(json);
    renderActivityGraph(json);
    loaded();
}
function loaded() {
    window.displayLoaded = true;
    document.body.style.opacity = "1.0";
}

function makeDummyData(now) {
    var data = {};

    for (var i=0; i < 30; i++) {
        var date = new Date(now.getTime() - (i*ONE_DAY));
        var dateString = date.toISOString().split("T")[0];

        data[dateString] = {};
        graphs.forEach(function(graphId) {
            data[dateString][graphId+"Pre"] = Math.random();
            data[dateString][graphId+"Post"] = Math.random();
        });
    }
    return data;
}

function normalizeJson(json) {
    json.meta = {}
    json.meta.now = new Date();
    json.meta.offset = 6 % json.meta.now.getDay();

    json.data = makeDummyData(json.meta.now);

    // In reverse chronological order...
    var dateStrings = Object.keys(json.data).sort().reverse();

    // Calendar values.
    var elements = dateStrings.map(function(dateString) {
        var dayOfData = json.data[dateString];
        var measures = [];
        var j = 1;
        for (var i=0; i < graphs.length; i++) {
            var preMeasure = dayOfData[graphs[i]+"Pre"];
            var postMeasure = dayOfData[graphs[i]+"Post"];
            measures.push(measureToEntry(preMeasure, j++));
            measures.push(measureToEntry(postMeasure, j++));
        }
        return measures;
    });
    json.calendar = elements;

    var object = {};
    graphs.forEach(function(graphId) {
        object[graphId] = {pre:[], post:[], labels:[]};
    });
    dateStrings.forEach(function(dateString) {
        var thisDay = new Date(dateString);
        var thisDayString = (thisDay.getMonth()+1)+ "/" + (thisDay.getDate());
        graphs.forEach(function(graphId) {
            var preMeasure = json.data[dateString][graphId+"Pre"] * 100;
            var postMeasure = json.data[dateString][graphId+"Post"] * 100;
            object[graphId].pre.push(preMeasure);
            object[graphId].post.push(postMeasure);
            object[graphId].labels.push(thisDayString);
        });
    });
    json.activities = object;

    window.data = json;
    return json;
}
function measureToEntry(measure, num) {
    if (measure > .5) {
        var color = colors[colorKeys[num]];
        return {value: sliceWidth, color:color};
    } else {
        return {value: sliceWidth, color:colors.empty};
    }
}
function renderCalendarGraph(json) {
    var offset = json.meta.offset;

    json.calendar.forEach(function(data, i) {
        var ctx = el("c"+(offset+i)).getContext("2d");
        new Chart(ctx).Pie(data,{showTooltips:false,segmentShowStroke:false});
    });
    graphs.forEach(function(graphId) {
        el(graphId+"-pre").style.backgroundColor = colors[graphId+"Pre"];
        el(graphId+"-post").style.backgroundColor = colors[graphId+"Post"];
    });
}
function colorActivityGraphLegend(graphId) {
    var before = el(graphId).parentNode.querySelector(".pre");
    before.style.backgroundColor = colors[graphId+"Pre"];

    var after = el(graphId).parentNode.querySelector(".post");
    after.style.backgroundColor = colors[graphId+"Post"];
}
function renderActivityGraph(json) {
    graphs.forEach(function(graphId, i) {
        colorActivityGraphLegend(graphId);

        var labels = json.activities[graphId].labels.slice(0,numDays);
        var pre = json.activities[graphId].pre.slice(0,numDays);
        var post = json.activities[graphId].post.slice(0,numDays);
        var data = {labels: labels, datasets: [
            {fillColor: colors[graphId+"Pre"], data: pre},
            {fillColor: colors[graphId+"Post"], data: post}
        ]};
        var ctx = el(graphId).getContext("2d");
        new Chart(ctx).BarAlt(data, {
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
    var width = (canvas.parentNode.clientWidth-10)
    canvas.style.width = canvas.style.height = width + "px";
}
function sizeWidth(canvas) {
    var width = (canvas.parentNode.clientWidth-20);
    canvas.style.width = width + "px";
    var height = (width/2.5);
    if (document.body.clientWidth <= 360) {
        height += 50;
    }
    canvas.style.height = height + "px";
}
function iterateOverCanvases(selector, func) {
    var canvases = document.body.querySelectorAll(selector);
    for (var i=0; i < canvases.length; i++) {
        func(canvases[i]);
    }
}

Chart.types.Bar.extend({
    name: "BarAlt",
    draw: function(){
        // the graph has padding at the top and the bottom that has to be calculated
        // to draw the bar corectly.

        // don't allow superclass to do this
        this.clear();
        var func = this.clear;
        this.clear = function() {};

        var offsetTop = this.scale.calculateY(100);
        var width = Math.floor(this.chart.canvas.scrollWidth);
        var height = Math.floor(this.chart.canvas.scrollHeight);
        var adjHeight = height - (height-this.scale.endPoint) - offsetTop;

        var ctx = this.chart.ctx;
        ctx.fillStyle = "#eee";
        ctx.fillRect(0, offsetTop + (adjHeight/4), width, (adjHeight/2));

        ctx.fillStyle = "black";
        ctx.fillRect(0, offsetTop + adjHeight, width, 2);

        Chart.types.Bar.prototype.draw.apply(this, arguments);
        this.clear = func;
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
function initNumDays() {
    numDays = (document.body.clientWidth > 360) ? 30 : 14;
}
function init() {
    initNumDays();
    iterateOverCanvases("#calendar canvas", sizeSquare);
    iterateOverCanvases("#activities canvas", sizeWidth);
}

window.onorientationchange = function() {
    init();
    displayGraph(window.data);
};

init(); // don't delete this even when moving to server data, it's needed.
displayGraph(normalizeJson({}));
