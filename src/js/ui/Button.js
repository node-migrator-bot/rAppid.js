rAppid.defineClass("js.ui.Button",
    ["underscore", "xaml!js.ui.Link", "js.core.Content"], function (_, Link) {
        return Link.inherit({
            defaults:{
                'componentClass': 'btn'
            }
        });
    }
);