define(["js/core/EventDispatcher", "js/lib/parser", "js/core/Binding","underscore"],
    function (EventDispatcher, Parser, Binding, _) {

        var indexExtractor = /^(.*)\[(\d+)\]$/,
            undefined, List;


        var Bindable = EventDispatcher.inherit("js.core.Bindable",
            {
                /***
                 * creates a new instance of bindable, which can be bound to components
                 *
                 * @param {Object} [attributes] the default attributes which will be set during instantiation
                 */
                ctor: function (attributes) {
                    this.$eventBindables = [];

                    // call the base class constructor
                    this.callBase(null);

                    this.$ = {};

                    _.extend(this._eventAttributes, this.base._eventAttributes || {});

                    attributes = attributes || {};

                    var defaultAttributes = this._defaultAttributes();
                    for (var key in defaultAttributes) {
                        if (defaultAttributes.hasOwnProperty(key)) {
                            if (!attributes.hasOwnProperty(key)) {
                                if (_.isFunction(defaultAttributes[key])) {
                                    // Function as default -> construct new Object
                                    attributes[key] = new (defaultAttributes[key])();
                                } else {
                                    attributes[key] = _.clone(defaultAttributes[key]);
                                }
                            }
                        }
                    }

                    this.$ = attributes;
                    // TODO: clone and keep prototype for attribute the same -> write own clone method
                    this.$previousAttributes = _.clone(attributes);

                },
                /**
                 * Here you can define the default attributes of the instance.
                 *
                 * @static
                 */
                defaults: {
                },

                /***
                 *
                 * @return {Object} returns the default attributes and includes the defaults from base classes
                 * @private
                 */
                _defaultAttributes: function () {
                    return this._generateDefaultsChain("defaults");
                },

                /***
                 * generates a default chain containing the values from this instance and base classes
                 *
                 * @param {String} property - the name of the static property used to find defaults
                 * @return {*}
                 * @private
                 */
                _generateDefaultsChain: function (property) {
                    var ret = this[property],
                        base = this.base;

                    while (base) {
                        _.defaults(ret, base[property]);
                        base = base.base;
                    }

                    return ret;
                },

                /**
                 * Sets new values for attributes and notify about changes
                 *
                 * @param {String} key The attribute key
                 * @param {String} value The attribute value
                 * @param {Object} options A hash of options
                 * @param {Boolean} [options.silent=false] if true no event is triggered on change
                 * @param {Boolean} [options.unset=false] if true the attribute gets deleted
                 */
                set: function (key, value, options) {
                    var attributes = {};

                    if (_.isString(key)) {
                        // check for path
                        var path = key.split(".");
                        if (path.length > 1) {
                            var scope = this.get(path.shift());
                            if (scope && scope.set) {
                                scope.set(path.join("."), value, options);
                                return this;
                            }

                        }

                        attributes[key] = value;
                    } else {
                        options = value;
                        attributes = key;
                    }

                    options = options || {silent: false, unset: false};

                    // for un-setting attributes
                    if (options.unset) {
                        for (key in attributes) {
                            if (attributes.hasOwnProperty(key)) {
                                attributes[key] = void 0;
                            }
                        }
                    }

                    var changedAttributes = {},
                        now = this.$,
                        val, prev;

                    for (key in attributes) {
                        if (attributes.hasOwnProperty(key)) {
                            // get the value
                            val = attributes[key];
                            // unset attribute or change it ...
                            if (options.unset === true) {
                                delete now[key];
                            } else {
                                if (!_.isEqual(now[key], attributes[key])) {
                                    prev = now[key];
                                    this.$previousAttributes[key] = prev;
                                    now[key] = attributes[key];
                                    changedAttributes[key] = now[key];
                                }
                            }
                        }
                    }

                    this._commitChangedAttributes(changedAttributes);

                    if (options.silent === false && _.size(changedAttributes) > 0) {
                        for (key in changedAttributes) {
                            if (changedAttributes.hasOwnProperty(key)) {
                                this.trigger('change:' + key, changedAttributes[key], this);
                            }
                        }
                        this.trigger('change', changedAttributes, this);
                    }

                    return this;
                },


                /***
                 * evaluates a path to retrieve a value
                 *
                 * @param {Object} [scope=this] the scope where the path is evaluated
                 * @param {String} key
                 * @returns the value for the path or undefined
                 */
                get: function(scope, key) {
                    if(!key){
                        key = scope;
                        scope = this;
                    }

                    if(!key) {
                        return null;
                    }

                    var path;

                    // if we have a path object
                    if(_.isArray(key)){
                        path = key;
                    // path element
                    }else if(_.isObject(key)){
                        path = [key];
                    }else{
                        path = Parser.parse(key, "path");
                    }


                    var pathElement;
                    // go through the path
                    while (scope && path.length > 0) {
                        pathElement = path.shift();
                        if (pathElement.type == "fnc") {
                            var fnc = scope[pathElement.name];
                            var parameters = pathElement.parameter;
                            for (var i = 0; i < parameters.length; i++) {
                                var param = parameters[i];
                                if (_.isObject(param)) {
                                    param.type = "static";
                                    parameters[i] = this.get(param.path);
                                }
                            }
                            scope = fnc.apply(scope, parameters);
                        } else if (pathElement.type == "var") {
                            if (scope instanceof Bindable) {
                                if(path.length === 0){
                                    scope = scope.$[pathElement.name];
                                }else{
                                    scope = scope.get(pathElement.name);
                                }

                            } else {
                                scope = scope[pathElement.name];
                            }
                        }

                        if(scope && pathElement.index !== ''){
                            // if it's an array
                            if(_.isArray(scope)){
                                scope = scope[pathElement.index];
                            // if it's a list
                            }else if(scope.at){
                                scope = scope.at(pathElement.index);
                            }
                        }
                    }
                    return scope;
                },

                /***
                 * determinate if a attribute is available
                 *
                 * @param {String} path - to get the value
                 * @returns {Boolean} true if attribute is not undefined
                 */
                has: function (path) {
                    return !_.isUndefined(this.get(path));
                },

                /***
                 * called after attributes has set and some of the has been changed
                 *
                 * @param {Object} attributes - contains the changed attributes
                 *
                 * @abstract
                 * @private
                 */
                _commitChangedAttributes: function (attributes) {
                    // override
                },

                /***
                 * Unset attribute on $
                 * @param {String|Object} key - the attribute or attributes to unset
                 * @param {Object} [options]
                 * @return {this}
                 */
                unset: function (key, options) {
                    (options || (options = {})).unset = true;
                    return this.set(key, null, options);
                },

                /***
                 * Clears all attributes
                 * @return {this}
                 */
                clear: function () {
                    return this.set(this.$, {unset: true});
                },

                /***
                 * Binds an event handler function to an EventDispatcher
                 *
                 * @param {String} path - a binding path e.g. a.b.c
                 * @param {String} event - the type of the event which should be bound
                 * @param {Function} callback - the event handler function
                 * @param {Object} [thisArg] - the thisArg used for calling the event handler
                 */
                bind: function (path, event, callback, thisArg) {
                    if (event instanceof Function && _.isString(path)) {
                        this.callBase(path, event, callback);
                    } else {
                        if(_.isArray(path) && path.length > 0){
                            thisArg = callback;
                            callback = event;
                            event = path[1];
                            path = path[0];
                        }
                        var eb = new EventBindable({
                            path: path,
                            event: event,
                            scope: thisArg,
                            callback: callback,
                            value: null
                        });
                        eb.set('binding', new Binding({path: path, scope: this, target: eb, targetKey: 'value'}));
                        this.$eventBindables.push(eb);
                    }
                },

                /***
                 * Unbinds an bound event handler from an EventDispatcher.
                 *
                 * @param {String} [path] - the path from which the event should be unbound
                 * @param {String} event - the type of the event
                 * @param {Function} callback - the event handler which is currently bound
                 * TODO: why a scope is passed here?
                 * @param {Object} [scope]
                 */
                unbind: function (path, event, callback, scope) {
                    if (event instanceof Function) {
                        this.callBase(path, event, callback);
                    } else {
                        var eb;
                        for (var i = this.$eventBindables.length - 1; i >= 0; i--) {
                            eb = this.$eventBindables[i];
                            if (eb.$.scope === scope && eb.$.path === path && eb.$.event === event && eb.$.callback === callback) {
                                // unbind
                                eb.destroy();
                                this.$eventBindables.slice(i, 1);
                            }
                        }
                    }
                },

                /***
                 * Destroys all event bindings and triggers a destroy event
                 * @return {this}
                 */
                destroy: function() {
                    this.callBase();
                    for(var i = 0; i < this.$eventBindables.length; i++){
                        this.$eventBindables[i].destroy();
                    }

                    this.trigger('destroy',this);
                    return this;
                }
            });

        var EventBindable = Bindable.inherit({
            _commitChangedAttributes: function (attributes) {
                this.callBase();
                this._unbindEvent(this.$previousAttributes['value']);
                if (!_.isUndefined(attributes.value)) {
                    this._bindEvent(attributes.value);
                }
            },
            _unbindEvent: function (value) {
                if (value && value instanceof EventDispatcher) {
                    value.unbind(this.$.event, this.$.callback, this.$.scope);
                }
            },
            _bindEvent: function (value) {
                if (value && value instanceof EventDispatcher) {
                    value.bind(this.$.event, this.$.callback, this.$.scope);
                }
            },
            destroy: function () {
                this._unbindEvent(this.$.value);
                this.$.binding.destroy();

                this.callBase();
            }
        });

        return Bindable;

    });