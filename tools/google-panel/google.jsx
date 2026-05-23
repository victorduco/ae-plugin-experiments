(function () {
    var panel = (this instanceof Panel) ? this : new Window("palette", "Google", undefined, { resizeable: true });

    panel.orientation = "column";
    panel.alignChildren = ["fill", "fill"];

    var urlInput = panel.add("edittext", undefined, "https://www.google.com");
    urlInput.preferredSize.height = 24;

    var openBtn = panel.add("button", undefined, "Open in Browser");
    openBtn.onClick = function () {
        var url = urlInput.text;
        if ($.os.indexOf("Windows") !== -1) {
            system.callSystem('cmd /c start "" "' + url + '"');
        } else {
            system.callSystem('open "' + url + '"');
        }
    };

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    } else {
        panel.layout.layout(true);
    }
}).call(this);
