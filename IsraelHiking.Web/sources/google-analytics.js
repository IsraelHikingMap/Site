(function (i, s, o, g, r, a, m) {
    i["GoogleAnalyticsObject"] = r; i[r] = i[r] || function () {
        (i[r].q = i[r].q || []).push(arguments)
    }, i[r].l = 1 * new Date(); a = s.createElement(o),
        m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
})(window, document, "script", "https://www.google-analytics.com/analytics.js", "ga");

var fields = {
    trackingId: "UA-106188182-1"
};

// if we are in the app (the protocol will be file://)
if (document.URL.indexOf("file://") === 0) {
    // we store and provide the clientId ourselves in localstorage since there are no
    // cookies in Cordova
    fields.clientId = localStorage.getItem("ga:clientId");
    // disable GA"s cookie storage functions
    fields.storage = "none";

    ga("create", fields);

    // prevent tasks that would abort tracking
    ga("set", {
        // don"t abort if the protocol is not http(s)
        checkProtocolTask: null,
        // don"t expect cookies to be enabled
        checkStorageTask: null
    });

    // a callback function to get the clientId and store it ourselves
    ga(function (tracker) {
        localStorage.setItem("ga:clientId", tracker.get("clientId"));
    });
} else {
    // if we are in a browser
    ga("create", fields);
}