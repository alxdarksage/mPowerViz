if (document.location.hash === "#pdf") {
    document.body.classList.add("showpdf");
}

var COLORS = {
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
     tremorPost: "#A9D7AA"
     */
};
var SHORT_COLORS = {
    empty: "#f4f4f4",
    tapLeftPre: "#54ABCC",
    tapLeftPost: "#54ABCC",
    tapRightPre: "#54ABCC",
    tapRightPost: "#EDB64F",
    walkPre: "#EDB64F",
    walkPost: "#EDB64F",
    voicePre: "#EDB64F",
    voicePost: "#744696",
    balancePre: "#744696",
    balancePost: "#744696"
}
var COLOR_KEYS = Object.keys(COLORS);
var FOUR_WEEKS = 1000*60*60*24*30;
var ONE_DAY = 1000*60*60*24;
var GRAPH_IDS = ['tapLeft','tapRight','walk','voice','balance'];
var SLICE_PERC = 100/10; // The size of a piece of pie. 5 post/pre measures = 10 pie pieces
var NUM_DAYS = 14; // Number of days to show on activity graph. We recalculate this on orientation change.

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
        GRAPH_IDS.forEach(function(graphId) {
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
        for (var i=0; i < GRAPH_IDS.length; i++) {
            var preMeasure = dayOfData[GRAPH_IDS[i]+"Pre"];
            var postMeasure = dayOfData[GRAPH_IDS[i]+"Post"];
            measures.push(measureToEntry(preMeasure, j++));
            measures.push(measureToEntry(postMeasure, j++));
        }
        return measures;
    });
    json.calendar = elements;

    var object = {};
    GRAPH_IDS.forEach(function(graphId) {
        object[graphId] = {pre:[], post:[], labels:[]};
    });
    dateStrings.forEach(function(dateString) {
        var thisDay = new Date(dateString);
        var thisDayString = (thisDay.getMonth()+1)+ "/" + (thisDay.getDate());
        GRAPH_IDS.forEach(function(graphId) {
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
        var color = SHORT_COLORS[COLOR_KEYS[num]];
        return {value: SLICE_PERC, color:color};
    } else {
        return {value: SLICE_PERC, color:COLORS.empty};
    }
}
function renderCalendarGraph(json) {
    var offset = json.meta.offset;

    json.calendar.forEach(function(data, i) {
        var result = data.filter(function(element) {
            return (element.color !== "#f4f4f4");
        });
        for (var j = result.length; j < 10; j++) {
            result.push({value:10, color:"#f4f4f4"});
        }

        var ctx = el("c"+(offset+i)).getContext("2d");
        new Chart(ctx).Doughnut(result, {
            showTooltips:false,
            segmentShowStroke:false,
            animation:false,
            percentageInnerCutout: 40
        });
    });
    GRAPH_IDS.forEach(function(graphId) {
        var pre = el(graphId+"-pre");
        if (pre) {
            pre.style.backgroundColor = COLORS[graphId+"Pre"];
        }
        var post = el(graphId+"-post");
        if (post) {
            post.style.backgroundColor = COLORS[graphId+"Post"];
        }
    });
}
function colorActivityGraphLegend(graphId) {
    var before = el(graphId).parentNode.querySelector(".pre");
    before.style.backgroundColor = COLORS[graphId+"Pre"];

    var after = el(graphId).parentNode.querySelector(".post");
    after.style.backgroundColor = COLORS[graphId+"Post"];
}
function renderActivityGraph(json) {
    GRAPH_IDS.forEach(function(graphId, i) {
        colorActivityGraphLegend(graphId);

        var labels = json.activities[graphId].labels.slice(0,NUM_DAYS);
        var pre = json.activities[graphId].pre.slice(0,NUM_DAYS);
        var post = json.activities[graphId].post.slice(0,NUM_DAYS);
        var data = {labels: labels, datasets: [
            {fillColor: COLORS[graphId+"Pre"], data: pre},
            {fillColor: COLORS[graphId+"Post"], data: post}
        ]};
        var ctx = el(graphId).getContext("2d");
        new Chart(ctx).BarAlt(data, {
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
Chart.types.Bar.extend({
    name: "BarAlt",
    draw: function(){
        // the graph has padding at the top and the bottom that has to be calculated
        // to draw the bar corectly.
        var ctx = this.chart.ctx;

        // don't allow superclass to do this
        this.clear();
        this.clear = function() {};

        var offsetTop = this.scale.calculateY(100);
        var width = Math.floor(this.chart.canvas.scrollWidth);
        var height = Math.floor(this.chart.canvas.scrollHeight);
        var adjHeight = height - (height-this.scale.endPoint) - offsetTop;

        var minY = .35;
        var maxY = .65;

        var pixelRatio = (adjHeight/100);
        var startY = Math.round(adjHeight * minY) * pixelRatio;
        var barHeight = Math.round(adjHeight * (maxY-minY)) * pixelRatio;

        ctx.fillStyle = "#eee";
        ctx.fillRect(0, offsetTop+startY, width, offsetTop+barHeight);

        ctx.beginPath();
        ctx.strokeWidth = 1;
        ctx.strokeStyle = '#eee';
        ctx.moveTo(0,offsetTop+adjHeight);
        ctx.lineTo(0,offsetTop-0.5);
        ctx.lineTo(width,offsetTop-0.5);
        ctx.lineTo(width,adjHeight+offsetTop);
        ctx.stroke();

        ctx.fillStyle = "black";
        ctx.strokeWidth = 0;
        ctx.fillRect(0, offsetTop + adjHeight, width, 2);

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
function init() {
    NUM_DAYS = (document.body.clientWidth > 360) ? 30 : 14;
    iterateOverCanvases("#calendar canvas", sizeSquare);
    iterateOverCanvases("#activities canvas", sizeWidth);
}

window.onorientationchange = function() {
    init();
    displayGraph(window.data);
};

init(); // don't delete this even when moving to server data, it's needed.
displayGraph(normalizeJson({}));
// REMOVEME
document.body.style.opacity = "1.0";
