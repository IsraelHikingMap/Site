function getURLParameter(name) {
    return decodeURIComponent((new RegExp("[?|&]" + name + "=" + "([^&;]+?)(&|#|;|$)").exec(location.search) || [, ""])[1].replace(/\+/g, "%20")) || null;
}

function redirect(isMTBMap) {
    var baseAddress = "http://IsraelHiking.osm.org.il/#/";
    var zoom = parseInt(getURLParameter("zoom"));
    var lat = parseFloat(getURLParameter("lat"));
    var lng = parseFloat(getURLParameter("lng"));
    var href = "";
    if (zoom > 0 && lat > 0 && lng > 0) {
        href = baseAddress + zoom + "/" + lat.toFixed(4) + "/" + lng.toFixed(4);
    } else {
        search = window.location.hash.split("?");
        var splittedpath = search[0].split("/");
        if (splittedpath.length == 3) {
            zoom = parseInt(splittedpath[splittedpath.length - 3].replace("#", ""));
            lat = parseFloat(splittedpath[splittedpath.length - 2]);
            lng = parseFloat(splittedpath[splittedpath.length - 1].split("?")[0]);
            href = baseAddress + zoom + "/" + lat.toFixed(4) + "/" + lng.toFixed(4);
        } else {
            href = baseAddress;
        }
        if (search.length > 1) {
            href += "?" + search[1];
        }
    }
    if (isMTBMap) {
        href += (href.indexOf("?") != -1) ? "&" : "?";
        href += "baselayer=Israel_MTB_Map";
    }
    setTimeout(function () {
        window.location.href = href;
    }, 1000);
}