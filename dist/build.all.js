(function () {/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.11 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.11',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite and existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part, length = ary.length;
            for (i = 0; i < length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = name.split('/');
                    lastIndex = name.length - 1;

                    // If wanting node ID compatibility, strip .js from end
                    // of IDs. Have to do this here, and not in nameToUrl
                    // because node allows either .js or non .js to map
                    // to same file.
                    if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                        name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                    }

                    name = normalizedBaseParts.concat(name);
                    trimDots(name);
                    name = name.join('/');
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);
                context.require([id]);
                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        normalizedName = normalize(name, parentName, applyMap);
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return  getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if(args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));

define("entry/js/lib/require", function(){});

/* Zepto v1.1.6 - zepto event ajax form ie - zeptojs.com/license */

var Zepto = (function() {
  var undefined, key, $, classList, emptyArray = [], slice = emptyArray.slice, filter = emptyArray.filter,
    document = window.document,
    elementDisplay = {}, classCache = {},
    cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    rootNodeRE = /^(?:body|html)$/i,
    capitalRE = /([A-Z])/g,

    // special attributes that should be get/set via method calls
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    readyRE = /complete|loaded|interactive/,
    simpleSelectorRE = /^[\w-]*$/,
    class2type = {},
    toString = class2type.toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div'),
    propMap = {
      'tabindex': 'tabIndex',
      'readonly': 'readOnly',
      'for': 'htmlFor',
      'class': 'className',
      'maxlength': 'maxLength',
      'cellspacing': 'cellSpacing',
      'cellpadding': 'cellPadding',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'usemap': 'useMap',
      'frameborder': 'frameBorder',
      'contenteditable': 'contentEditable'
    },
    isArray = Array.isArray ||
      function(object){ return object instanceof Array }

  zepto.matches = function(element, selector) {
    if (!selector || !element || element.nodeType !== 1) return false
    var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
                          element.oMatchesSelector || element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    var match, parent = element.parentNode, temp = !parent
    if (temp) (parent = tempParent).appendChild(element)
    match = ~zepto.qsa(parent, selector).indexOf(element)
    temp && tempParent.removeChild(element)
    return match
  }

  function type(obj) {
    return obj == null ? String(obj) :
      class2type[toString.call(obj)] || "object"
  }

  function isFunction(value) { return type(value) == "function" }
  function isWindow(obj)     { return obj != null && obj == obj.window }
  function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
  function isObject(obj)     { return type(obj) == "object" }
  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
  }
  function likeArray(obj) { return typeof obj.length == 'number' }

  function compact(array) { return filter.call(array, function(item){ return item != null }) }
  function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }
  camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
  function dasherize(str) {
    return str.replace(/::/g, '/')
           .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
           .replace(/([a-z\d])([A-Z])/g, '$1_$2')
           .replace(/_/g, '-')
           .toLowerCase()
  }
  uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  function maybeAddPx(name, value) {
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  function children(element) {
    return 'children' in element ?
      slice.call(element.children) :
      $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overriden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  zepto.fragment = function(html, name, properties) {
    var dom, nodes, container

    // A special case optimization for a single tag
    if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

    if (!dom) {
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      if (!(name in containers)) name = '*'

      container = containers[name]
      container.innerHTML = '' + html
      dom = $.each(slice.call(container.childNodes), function(){
        container.removeChild(this)
      })
    }

    if (isPlainObject(properties)) {
      nodes = $(dom)
      $.each(properties, function(key, value) {
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        else nodes.attr(key, value)
      })
    }

    return dom
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. Note that `__proto__` is not supported on Internet
  // Explorer. This method can be overriden in plugins.
  zepto.Z = function(dom, selector) {
    dom = dom || []
    dom.__proto__ = $.fn
    dom.selector = selector || ''
    return dom
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overriden in plugins.
  zepto.isZ = function(object) {
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overriden in plugins.
  zepto.init = function(selector, context) {
    var dom
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // Optimize for string selectors
    else if (typeof selector == 'string') {
      selector = selector.trim()
      // If it's a html fragment, create nodes from it
      // Note: In both Chrome 21 and Firefox 15, DOM error 12
      // is thrown if the fragment doesn't begin with <
      if (selector[0] == '<' && fragmentRE.test(selector))
        dom = zepto.fragment(selector, RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // If it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // If a function is given, call it when the DOM is ready
    else if (isFunction(selector)) return $(document).ready(selector)
    // If a Zepto collection is given, just return it
    else if (zepto.isZ(selector)) return selector
    else {
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes.
      else if (isObject(selector))
        dom = [selector], selector = null
      // If it's a html fragment, create nodes from it
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // create a new Zepto collection from the nodes found
    return zepto.Z(dom, selector)
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  $ = function(selector, context){
    return zepto.init(selector, context)
  }

  function extend(target, source, deep) {
    for (key in source)
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []
        extend(target[key], source[key], deep)
      }
      else if (source[key] !== undefined) target[key] = source[key]
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function(target){
    var deep, args = slice.call(arguments, 1)
    if (typeof target == 'boolean') {
      deep = target
      target = args.shift()
    }
    args.forEach(function(arg){ extend(target, arg, deep) })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overriden in plugins.
  zepto.qsa = function(element, selector){
    var found,
        maybeID = selector[0] == '#',
        maybeClass = !maybeID && selector[0] == '.',
        nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
        isSimple = simpleSelectorRE.test(nameOnly)
    return (isDocument(element) && isSimple && maybeID) ?
      ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
      (element.nodeType !== 1 && element.nodeType !== 9) ? [] :
      slice.call(
        isSimple && !maybeID ?
          maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
          element.getElementsByTagName(selector) : // Or a tag
          element.querySelectorAll(selector) // Or it's not simple, and we need to query all
      )
  }

  function filtered(nodes, selector) {
    return selector == null ? $(nodes) : $(nodes).filter(selector)
  }

  $.contains = document.documentElement.contains ?
    function(parent, node) {
      return parent !== node && parent.contains(node)
    } :
    function(parent, node) {
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }

  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  function setAttribute(node, name, value) {
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  // access className property while respecting SVGAnimatedString
  function className(node, value){
    var klass = node.className || '',
        svg   = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  // "true"  => true
  // "false" => false
  // "null"  => null
  // "42"    => 42
  // "42.5"  => 42.5
  // "08"    => "08"
  // JSON    => parse if valid
  // String  => self
  function deserializeValue(value) {
    try {
      return value ?
        value == "true" ||
        ( value == "false" ? false :
          value == "null" ? null :
          +value + "" == value ? +value :
          /^[\[\{]/.test(value) ? $.parseJSON(value) :
          value )
        : value
    } catch(e) {
      return value
    }
  }

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  $.isEmptyObject = function(obj) {
    var name
    for (name in obj) return false
    return true
  }

  $.inArray = function(elem, array, i){
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.camelCase = camelize
  $.trim = function(str) {
    return str == null ? "" : String.prototype.trim.call(str)
  }

  // plugin compatibility
  $.uuid = 0
  $.support = { }
  $.expr = { }

  $.map = function(elements, callback){
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  $.each = function(elements, callback){
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  $.grep = function(elements, callback){
    return filter.call(elements, callback)
  }

  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
    class2type[ "[object " + name + "]" ] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    indexOf: emptyArray.indexOf,
    concat: emptyArray.concat,

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    map: function(fn){
      return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
    },
    slice: function(){
      return $(slice.apply(this, arguments))
    },

    ready: function(callback){
      // need to check if document.body exists for IE as that browser reports
      // document ready when it hasn't yet created the body element
      if (readyRE.test(document.readyState) && document.body) callback($)
      else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
      return this
    },
    get: function(idx){
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    toArray: function(){ return this.get() },
    size: function(){
      return this.length
    },
    remove: function(){
      return this.each(function(){
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    each: function(callback){
      emptyArray.every.call(this, function(el, idx){
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    filter: function(selector){
      if (isFunction(selector)) return this.not(this.not(selector))
      return $(filter.call(this, function(element){
        return zepto.matches(element, selector)
      }))
    },
    add: function(selector,context){
      return $(uniq(this.concat($(selector,context))))
    },
    is: function(selector){
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    not: function(selector){
      var nodes=[]
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function(idx){
          if (!selector.call(this,idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function(el){
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    has: function(selector){
      return this.filter(function(){
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    eq: function(idx){
      return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
    },
    first: function(){
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    last: function(){
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    find: function(selector){
      var result, $this = this
      if (!selector) result = $()
      else if (typeof selector == 'object')
        result = $(selector).filter(function(){
          var node = this
          return emptyArray.some.call($this, function(parent){
            return $.contains(parent, node)
          })
        })
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      else result = this.map(function(){ return zepto.qsa(this, selector) })
      return result
    },
    closest: function(selector, context){
      var node = this[0], collection = false
      if (typeof selector == 'object') collection = $(selector)
      while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
        node = node !== context && !isDocument(node) && node.parentNode
      return $(node)
    },
    parents: function(selector){
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function(node){
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    parent: function(selector){
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    children: function(selector){
      return filtered(this.map(function(){ return children(this) }), selector)
    },
    contents: function() {
      return this.map(function() { return slice.call(this.childNodes) })
    },
    siblings: function(selector){
      return filtered(this.map(function(i, el){
        return filter.call(children(el.parentNode), function(child){ return child!==el })
      }), selector)
    },
    empty: function(){
      return this.each(function(){ this.innerHTML = '' })
    },
    // `pluck` is borrowed from Prototype.js
    pluck: function(property){
      return $.map(this, function(el){ return el[property] })
    },
    show: function(){
      return this.each(function(){
        this.style.display == "none" && (this.style.display = '')
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function(newContent){
      return this.before(newContent).remove()
    },
    wrap: function(structure){
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom   = $(structure).get(0),
            clone = dom.parentNode || this.length > 1

      return this.each(function(index){
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    wrapAll: function(structure){
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    wrapInner: function(structure){
      var func = isFunction(structure)
      return this.each(function(index){
        var self = $(this), contents = self.contents(),
            dom  = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    unwrap: function(){
      this.parent().each(function(){
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function(){
      return this.map(function(){ return this.cloneNode(true) })
    },
    hide: function(){
      return this.css("display", "none")
    },
    toggle: function(setting){
      return this.each(function(){
        var el = $(this)
        ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
    next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
    html: function(html){
      return 0 in arguments ?
        this.each(function(idx){
          var originHtml = this.innerHTML
          $(this).empty().append( funcArg(this, html, idx, originHtml) )
        }) :
        (0 in this ? this[0].innerHTML : null)
    },
    text: function(text){
      return 0 in arguments ?
        this.each(function(idx){
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : ''+newText
        }) :
        (0 in this ? this[0].textContent : null)
    },
    attr: function(name, value){
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
        (!this.length || this[0].nodeType !== 1 ? undefined :
          (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
        ) :
        this.each(function(idx){
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function(name){
      return this.each(function(){ this.nodeType === 1 && name.split(' ').forEach(function(attribute){
        setAttribute(this, attribute)
      }, this)})
    },
    prop: function(name, value){
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function(idx){
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    data: function(name, value){
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
        this.attr(attrName, value) :
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    val: function(value){
      return 0 in arguments ?
        this.each(function(idx){
          this.value = funcArg(this, value, idx, this.value)
        }) :
        (this[0] && (this[0].multiple ?
           $(this[0]).find('option').filter(function(){ return this.selected }).pluck('value') :
           this[0].value)
        )
    },
    offset: function(coordinates){
      if (coordinates) return this.each(function(index){
        var $this = $(this),
            coords = funcArg(this, coordinates, index, $this.offset()),
            parentOffset = $this.offsetParent().offset(),
            props = {
              top:  coords.top  - parentOffset.top,
              left: coords.left - parentOffset.left
            }

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      if (!this.length) return null
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    css: function(property, value){
      if (arguments.length < 2) {
        var computedStyle, element = this[0]
        if(!element) return
        computedStyle = getComputedStyle(element, '')
        if (typeof property == 'string')
          return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
        else if (isArray(property)) {
          var props = {}
          $.each(property, function(_, prop){
            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
          })
          return props
        }
      }

      var css = ''
      if (type(property) == 'string') {
        if (!value && value !== 0)
          this.each(function(){ this.style.removeProperty(dasherize(property)) })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function(){ this.style.removeProperty(dasherize(key)) })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function(){ this.style.cssText += ';' + css })
    },
    index: function(element){
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function(name){
      if (!name) return false
      return emptyArray.some.call(this, function(el){
        return this.test(className(el))
      }, classRE(name))
    },
    addClass: function(name){
      if (!name) return this
      return this.each(function(idx){
        if (!('className' in this)) return
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function(klass){
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    removeClass: function(name){
      return this.each(function(idx){
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    toggleClass: function(name, when){
      if (!name) return this
      return this.each(function(idx){
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function(klass){
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    scrollTop: function(value){
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      return this.each(hasScrollTop ?
        function(){ this.scrollTop = value } :
        function(){ this.scrollTo(this.scrollX, value) })
    },
    scrollLeft: function(value){
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function(){ this.scrollLeft = value } :
        function(){ this.scrollTo(value, this.scrollY) })
    },
    position: function() {
      if (!this.length) return

      var elem = this[0],
        // Get *real* offsetParent
        offsetParent = this.offsetParent(),
        // Get correct offsets
        offset       = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
      offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

      // Add offsetParent borders
      parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
      parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

      // Subtract the two offsets
      return {
        top:  offset.top  - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    offsetParent: function() {
      return this.map(function(){
        var parent = this.offsetParent || document.body
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

  // Generate the `width` and `height` functions
  ;['width', 'height'].forEach(function(dimension){
    var dimensionProperty =
      dimension.replace(/./, function(m){ return m[0].toUpperCase() })

    $.fn[dimension] = function(value){
      var offset, el = this[0]
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function(idx){
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function(operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function(){
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function(arg) {
            argType = type(arg)
            return argType == "object" || argType == "array" || arg == null ?
              arg : zepto.fragment(arg)
          }),
          parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function(_, target){
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling :
                 operatorIndex == 1 ? target.firstChild :
                 operatorIndex == 2 ? target :
                 null

        var parentInDocument = $.contains(document.documentElement, parent)

        nodes.forEach(function(node){
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          parent.insertBefore(node, target)
          if (parentInDocument) traverseNode(node, function(el){
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
               (!el.type || el.type === 'text/javascript') && !el.src)
              window['eval'].call(window, el.innerHTML)
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
      $(html)[operator](this)
      return this
    }
  })

  zepto.Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

window.Zepto = Zepto
window.$ === undefined && (window.$ = Zepto)

;(function($){
  var _zid = 1, undefined,
      slice = Array.prototype.slice,
      isFunction = $.isFunction,
      isString = function(obj){ return typeof obj == 'string' },
      handlers = {},
      specialEvents={},
      focusinSupported = 'onfocusin' in window,
      focus = { focus: 'focusin', blur: 'focusout' },
      hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

  specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

  function zid(element) {
    return element._zid || (element._zid = _zid++)
  }
  function findHandlers(element, event, fn, selector) {
    event = parse(event)
    if (event.ns) var matcher = matcherFor(event.ns)
    return (handlers[zid(element)] || []).filter(function(handler) {
      return handler
        && (!event.e  || handler.e == event.e)
        && (!event.ns || matcher.test(handler.ns))
        && (!fn       || zid(handler.fn) === zid(fn))
        && (!selector || handler.sel == selector)
    })
  }
  function parse(event) {
    var parts = ('' + event).split('.')
    return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
  }
  function matcherFor(ns) {
    return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
  }

  function eventCapture(handler, captureSetting) {
    return handler.del &&
      (!focusinSupported && (handler.e in focus)) ||
      !!captureSetting
  }

  function realEvent(type) {
    return hover[type] || (focusinSupported && focus[type]) || type
  }

  function add(element, events, fn, data, selector, delegator, capture){
    var id = zid(element), set = (handlers[id] || (handlers[id] = []))
    events.split(/\s/).forEach(function(event){
      if (event == 'ready') return $(document).ready(fn)
      var handler   = parse(event)
      handler.fn    = fn
      handler.sel   = selector
      // emulate mouseenter, mouseleave
      if (handler.e in hover) fn = function(e){
        var related = e.relatedTarget
        if (!related || (related !== this && !$.contains(this, related)))
          return handler.fn.apply(this, arguments)
      }
      handler.del   = delegator
      var callback  = delegator || fn
      handler.proxy = function(e){
        e = compatible(e)
        if (e.isImmediatePropagationStopped()) return
        e.data = data
        var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
        if (result === false) e.preventDefault(), e.stopPropagation()
        return result
      }
      handler.i = set.length
      set.push(handler)
      if ('addEventListener' in element)
        element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
    })
  }
  function remove(element, events, fn, selector, capture){
    var id = zid(element)
    ;(events || '').split(/\s/).forEach(function(event){
      findHandlers(element, event, fn, selector).forEach(function(handler){
        delete handlers[id][handler.i]
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
      })
    })
  }

  $.event = { add: add, remove: remove }

  $.proxy = function(fn, context) {
    var args = (2 in arguments) && slice.call(arguments, 2)
    if (isFunction(fn)) {
      var proxyFn = function(){ return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments) }
      proxyFn._zid = zid(fn)
      return proxyFn
    } else if (isString(context)) {
      if (args) {
        args.unshift(fn[context], fn)
        return $.proxy.apply(null, args)
      } else {
        return $.proxy(fn[context], fn)
      }
    } else {
      throw new TypeError("expected function")
    }
  }

  $.fn.bind = function(event, data, callback){
    return this.on(event, data, callback)
  }
  $.fn.unbind = function(event, callback){
    return this.off(event, callback)
  }
  $.fn.one = function(event, selector, data, callback){
    return this.on(event, selector, data, callback, 1)
  }

  var returnTrue = function(){return true},
      returnFalse = function(){return false},
      ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
      eventMethods = {
        preventDefault: 'isDefaultPrevented',
        stopImmediatePropagation: 'isImmediatePropagationStopped',
        stopPropagation: 'isPropagationStopped'
      }

  function compatible(event, source) {
    if (source || !event.isDefaultPrevented) {
      source || (source = event)

      $.each(eventMethods, function(name, predicate) {
        var sourceMethod = source[name]
        event[name] = function(){
          this[predicate] = returnTrue
          return sourceMethod && sourceMethod.apply(source, arguments)
        }
        event[predicate] = returnFalse
      })

      if (source.defaultPrevented !== undefined ? source.defaultPrevented :
          'returnValue' in source ? source.returnValue === false :
          source.getPreventDefault && source.getPreventDefault())
        event.isDefaultPrevented = returnTrue
    }
    return event
  }

  function createProxy(event) {
    var key, proxy = { originalEvent: event }
    for (key in event)
      if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

    return compatible(proxy, event)
  }

  $.fn.delegate = function(selector, event, callback){
    return this.on(event, selector, callback)
  }
  $.fn.undelegate = function(selector, event, callback){
    return this.off(event, selector, callback)
  }

  $.fn.live = function(event, callback){
    $(document.body).delegate(this.selector, event, callback)
    return this
  }
  $.fn.die = function(event, callback){
    $(document.body).undelegate(this.selector, event, callback)
    return this
  }

  $.fn.on = function(event, selector, data, callback, one){
    var autoRemove, delegator, $this = this
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.on(type, selector, data, fn, one)
      })
      return $this
    }

    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = data, data = selector, selector = undefined
    if (isFunction(data) || data === false)
      callback = data, data = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(_, element){
      if (one) autoRemove = function(e){
        remove(element, e.type, callback)
        return callback.apply(this, arguments)
      }

      if (selector) delegator = function(e){
        var evt, match = $(e.target).closest(selector, element).get(0)
        if (match && match !== element) {
          evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
          return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
        }
      }

      add(element, event, callback, data, selector, delegator || autoRemove)
    })
  }
  $.fn.off = function(event, selector, callback){
    var $this = this
    if (event && !isString(event)) {
      $.each(event, function(type, fn){
        $this.off(type, selector, fn)
      })
      return $this
    }

    if (!isString(selector) && !isFunction(callback) && callback !== false)
      callback = selector, selector = undefined

    if (callback === false) callback = returnFalse

    return $this.each(function(){
      remove(this, event, callback, selector)
    })
  }

  $.fn.trigger = function(event, args){
    event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
    event._args = args
    return this.each(function(){
      // handle focus(), blur() by calling them directly
      if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
      // items in the collection might not be DOM elements
      else if ('dispatchEvent' in this) this.dispatchEvent(event)
      else $(this).triggerHandler(event, args)
    })
  }

  // triggers event handlers on current element just as if an event occurred,
  // doesn't trigger an actual event, doesn't bubble
  $.fn.triggerHandler = function(event, args){
    var e, result
    this.each(function(i, element){
      e = createProxy(isString(event) ? $.Event(event) : event)
      e._args = args
      e.target = element
      $.each(findHandlers(element, event.type || event), function(i, handler){
        result = handler.proxy(e)
        if (e.isImmediatePropagationStopped()) return false
      })
    })
    return result
  }

  // shortcut methods for `.bind(event, fn)` for each event type
  ;('focusin focusout focus blur load resize scroll unload click dblclick '+
  'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
  'change select keydown keypress keyup error').split(' ').forEach(function(event) {
    $.fn[event] = function(callback) {
      return (0 in arguments) ?
        this.bind(event, callback) :
        this.trigger(event)
    }
  })

  $.Event = function(type, props) {
    if (!isString(type)) props = type, type = props.type
    var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
    if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
    event.initEvent(type, bubbles, true)
    return compatible(event)
  }

})(Zepto)

;(function($){
  var jsonpID = 0,
      document = window.document,
      key,
      name,
      rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      scriptTypeRE = /^(?:text|application)\/javascript/i,
      xmlTypeRE = /^(?:text|application)\/xml/i,
      jsonType = 'application/json',
      htmlType = 'text/html',
      blankRE = /^\s*$/,
      originAnchor = document.createElement('a')

  originAnchor.href = window.location.href

  // trigger a custom event and return false if it was cancelled
  function triggerAndReturn(context, eventName, data) {
    var event = $.Event(eventName)
    $(context).trigger(event, data)
    return !event.isDefaultPrevented()
  }

  // trigger an Ajax "global" event
  function triggerGlobal(settings, context, eventName, data) {
    if (settings.global) return triggerAndReturn(context || document, eventName, data)
  }

  // Number of active Ajax requests
  $.active = 0

  function ajaxStart(settings) {
    if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
  }
  function ajaxStop(settings) {
    if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
  }

  // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
  function ajaxBeforeSend(xhr, settings) {
    var context = settings.context
    if (settings.beforeSend.call(context, xhr, settings) === false ||
        triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
      return false

    triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
  }
  function ajaxSuccess(data, xhr, settings, deferred) {
    var context = settings.context, status = 'success'
    settings.success.call(context, data, status, xhr)
    if (deferred) deferred.resolveWith(context, [data, status, xhr])
    triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
    ajaxComplete(status, xhr, settings)
  }
  // type: "timeout", "error", "abort", "parsererror"
  function ajaxError(error, type, xhr, settings, deferred) {
    var context = settings.context
    settings.error.call(context, xhr, type, error)
    if (deferred) deferred.rejectWith(context, [xhr, type, error])
    triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
    ajaxComplete(type, xhr, settings)
  }
  // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
  function ajaxComplete(status, xhr, settings) {
    var context = settings.context
    settings.complete.call(context, xhr, status)
    triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
    ajaxStop(settings)
  }

  // Empty function, used as default callback
  function empty() {}

  $.ajaxJSONP = function(options, deferred){
    if (!('type' in options)) return $.ajax(options)

    var _callbackName = options.jsonpCallback,
      callbackName = ($.isFunction(_callbackName) ?
        _callbackName() : _callbackName) || ('jsonp' + (++jsonpID)),
      script = document.createElement('script'),
      originalCallback = window[callbackName],
      responseData,
      abort = function(errorType) {
        $(script).triggerHandler('error', errorType || 'abort')
      },
      xhr = { abort: abort }, abortTimeout

    if (deferred) deferred.promise(xhr)

    $(script).on('load error', function(e, errorType){
      clearTimeout(abortTimeout)
      $(script).off().remove()

      if (e.type == 'error' || !responseData) {
        ajaxError(null, errorType || 'error', xhr, options, deferred)
      } else {
        ajaxSuccess(responseData[0], xhr, options, deferred)
      }

      window[callbackName] = originalCallback
      if (responseData && $.isFunction(originalCallback))
        originalCallback(responseData[0])

      originalCallback = responseData = undefined
    })

    if (ajaxBeforeSend(xhr, options) === false) {
      abort('abort')
      return xhr
    }

    window[callbackName] = function(){
      responseData = arguments
    }

    script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
    document.head.appendChild(script)

    if (options.timeout > 0) abortTimeout = setTimeout(function(){
      abort('timeout')
    }, options.timeout)

    return xhr
  }

  $.ajaxSettings = {
    // Default type of request
    type: 'GET',
    // Callback that is executed before request
    beforeSend: empty,
    // Callback that is executed if the request succeeds
    success: empty,
    // Callback that is executed the the server drops error
    error: empty,
    // Callback that is executed on request complete (both: error and success)
    complete: empty,
    // The context for the callbacks
    context: null,
    // Whether to trigger "global" Ajax events
    global: true,
    // Transport
    xhr: function () {
      return new window.XMLHttpRequest()
    },
    // MIME types mapping
    // IIS returns Javascript as "application/x-javascript"
    accepts: {
      script: 'text/javascript, application/javascript, application/x-javascript',
      json:   jsonType,
      xml:    'application/xml, text/xml',
      html:   htmlType,
      text:   'text/plain'
    },
    // Whether the request is to another domain
    crossDomain: false,
    // Default timeout
    timeout: 0,
    // Whether data should be serialized to string
    processData: true,
    // Whether the browser should be allowed to cache GET responses
    cache: true
  }

  function mimeToDataType(mime) {
    if (mime) mime = mime.split(';', 2)[0]
    return mime && ( mime == htmlType ? 'html' :
      mime == jsonType ? 'json' :
      scriptTypeRE.test(mime) ? 'script' :
      xmlTypeRE.test(mime) && 'xml' ) || 'text'
  }

  function appendQuery(url, query) {
    if (query == '') return url
    return (url + '&' + query).replace(/[&?]{1,2}/, '?')
  }

  // serialize payload and append it to the URL for GET requests
  function serializeData(options) {
    if (options.processData && options.data && $.type(options.data) != "string")
      options.data = $.param(options.data, options.traditional)
    if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
      options.url = appendQuery(options.url, options.data), options.data = undefined
  }

  $.ajax = function(options){
    var settings = $.extend({}, options || {}),
        deferred = $.Deferred && $.Deferred(),
        urlAnchor
    for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

    ajaxStart(settings)

    if (!settings.crossDomain) {
      urlAnchor = document.createElement('a')
      urlAnchor.href = settings.url
      urlAnchor.href = urlAnchor.href
      settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
    }

    if (!settings.url) settings.url = window.location.toString()
    serializeData(settings)

    var dataType = settings.dataType, hasPlaceholder = /\?.+=\?/.test(settings.url)
    if (hasPlaceholder) dataType = 'jsonp'

    if (settings.cache === false || (
         (!options || options.cache !== true) &&
         ('script' == dataType || 'jsonp' == dataType)
        ))
      settings.url = appendQuery(settings.url, '_=' + Date.now())

    if ('jsonp' == dataType) {
      if (!hasPlaceholder)
        settings.url = appendQuery(settings.url,
          settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
      return $.ajaxJSONP(settings, deferred)
    }

    var mime = settings.accepts[dataType],
        headers = { },
        setHeader = function(name, value) { headers[name.toLowerCase()] = [name, value] },
        protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
        xhr = settings.xhr(),
        nativeSetHeader = xhr.setRequestHeader,
        abortTimeout

    if (deferred) deferred.promise(xhr)

    if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
    setHeader('Accept', mime || '*/*')
    if (mime = settings.mimeType || mime) {
      if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
      xhr.overrideMimeType && xhr.overrideMimeType(mime)
    }
    if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
      setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

    if (settings.headers) for (name in settings.headers) setHeader(name, settings.headers[name])
    xhr.setRequestHeader = setHeader

    xhr.onreadystatechange = function(){
      if (xhr.readyState == 4) {
        xhr.onreadystatechange = empty
        clearTimeout(abortTimeout)
        var result, error = false
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
          dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))
          result = xhr.responseText

          try {
            // http://perfectionkills.com/global-eval-what-are-the-options/
            if (dataType == 'script')    (1,eval)(result)
            else if (dataType == 'xml')  result = xhr.responseXML
            else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
          } catch (e) { error = e }

          if (error) ajaxError(error, 'parsererror', xhr, settings, deferred)
          else ajaxSuccess(result, xhr, settings, deferred)
        } else {
          ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
        }
      }
    }

    if (ajaxBeforeSend(xhr, settings) === false) {
      xhr.abort()
      ajaxError(null, 'abort', xhr, settings, deferred)
      return xhr
    }

    if (settings.xhrFields) for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

    var async = 'async' in settings ? settings.async : true
    xhr.open(settings.type, settings.url, async, settings.username, settings.password)

    for (name in headers) nativeSetHeader.apply(xhr, headers[name])

    if (settings.timeout > 0) abortTimeout = setTimeout(function(){
        xhr.onreadystatechange = empty
        xhr.abort()
        ajaxError(null, 'timeout', xhr, settings, deferred)
      }, settings.timeout)

    // avoid sending empty string (#319)
    xhr.send(settings.data ? settings.data : null)
    return xhr
  }

  // handle optional data/success arguments
  function parseArguments(url, data, success, dataType) {
    if ($.isFunction(data)) dataType = success, success = data, data = undefined
    if (!$.isFunction(success)) dataType = success, success = undefined
    return {
      url: url
    , data: data
    , success: success
    , dataType: dataType
    }
  }

  $.get = function(/* url, data, success, dataType */){
    return $.ajax(parseArguments.apply(null, arguments))
  }

  $.post = function(/* url, data, success, dataType */){
    var options = parseArguments.apply(null, arguments)
    options.type = 'POST'
    return $.ajax(options)
  }

  $.getJSON = function(/* url, data, success */){
    var options = parseArguments.apply(null, arguments)
    options.dataType = 'json'
    return $.ajax(options)
  }

  $.fn.load = function(url, data, success){
    if (!this.length) return this
    var self = this, parts = url.split(/\s/), selector,
        options = parseArguments(url, data, success),
        callback = options.success
    if (parts.length > 1) options.url = parts[0], selector = parts[1]
    options.success = function(response){
      self.html(selector ?
        $('<div>').html(response.replace(rscript, "")).find(selector)
        : response)
      callback && callback.apply(self, arguments)
    }
    $.ajax(options)
    return this
  }

  var escape = encodeURIComponent

  function serialize(params, obj, traditional, scope){
    var type, array = $.isArray(obj), hash = $.isPlainObject(obj)
    $.each(obj, function(key, value) {
      type = $.type(value)
      if (scope) key = traditional ? scope :
        scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
      // handle data in serializeArray() format
      if (!scope && array) params.add(value.name, value.value)
      // recurse into nested objects
      else if (type == "array" || (!traditional && type == "object"))
        serialize(params, value, traditional, key)
      else params.add(key, value)
    })
  }

  $.param = function(obj, traditional){
    var params = []
    params.add = function(key, value) {
      if ($.isFunction(value)) value = value()
      if (value == null) value = ""
      this.push(escape(key) + '=' + escape(value))
    }
    serialize(params, obj, traditional)
    return params.join('&').replace(/%20/g, '+')
  }
})(Zepto)

;(function($){
  $.fn.serializeArray = function() {
    var name, type, result = [],
      add = function(value) {
        if (value.forEach) return value.forEach(add)
        result.push({ name: name, value: value })
      }
    if (this[0]) $.each(this[0].elements, function(_, field){
      type = field.type, name = field.name
      if (name && field.nodeName.toLowerCase() != 'fieldset' &&
        !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
        ((type != 'radio' && type != 'checkbox') || field.checked))
          add($(field).val())
    })
    return result
  }

  $.fn.serialize = function(){
    var result = []
    this.serializeArray().forEach(function(elm){
      result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
    })
    return result.join('&')
  }

  $.fn.submit = function(callback) {
    if (0 in arguments) this.bind('submit', callback)
    else if (this.length) {
      var event = $.Event('submit')
      this.eq(0).trigger(event)
      if (!event.isDefaultPrevented()) this.get(0).submit()
    }
    return this
  }

})(Zepto)

;(function($){
  // __proto__ doesn't exist on IE<11, so redefine
  // the Z function to use object extension instead
  if (!('__proto__' in {})) {
    $.extend($.zepto, {
      Z: function(dom, selector){
        dom = dom || []
        $.extend(dom, $.fn)
        dom.selector = selector || ''
        dom.__Z = true
        return dom
      },
      // this is a kludge but works
      isZ: function(object){
        return $.type(object) === 'array' && '__Z' in object
      }
    })
  }

  // getComputedStyle shouldn't freak out when called
  // without a valid element as argument
  try {
    getComputedStyle(undefined)
  } catch(e) {
    var nativeGetComputedStyle = getComputedStyle;
    window.getComputedStyle = function(element){
      try {
        return nativeGetComputedStyle(element)
      } catch(e) {
        return null
      }
    }
  }
})(Zepto)
;
define("entry/js/lib/zepto", function(){});

define('entry/js/core/tools',[],function() {
	var Tools = {
		getCurrentStyle: function(elem, style) {
			var style;
			if (window.getComputedStyle) {
				var obj = window.getComputedStyle(elem, null);
				style = obj.getPropertyValue(style);
			} else {
				style = elem.currentStyle;
			}
			return style;
		},
		scrollNum: function(elem) {
			var initi = 1;
			var num = $(elem).html();
			if (!!!num) return;
			num = num.replace(/[^\d]/g, "") + "";
			var len = num.length;
			var content = ""; 

			for(var i = 0; i < len; i++) {
				content += '<i>0</i>';
			}
			$(elem).html(content);
			doscroll();

			function doscroll() {
				var ili = $(elem).find('i');
				var n = len - initi, tims = 0;
				var show = num.substring(len - initi, len - initi + 1);
				if (n < 0) return;
				var st = setInterval(function() {
					$(elem).find('i').eq(len - initi).html(parseInt(Math.random() * 10));
					tims += 1;
					if (tims >= 10) {
						clearInterval(st);
						$(elem).find('i').eq(len - initi).html(show);
						initi += 1;
						doscroll();
					}
				}, 50);
			}
		},
		lazyLoad: function(imgs) {
			function show(imgs, src) {
				$(imgs).css("opacity", 0);
				setTimeout(function() {
					$(imgs).attr("src", src);
					$(imgs).removeAttr("data-src");
					setTimeout(function(){
						$(imgs).css("opacity", 1);
					}, 0);
				},200);
			}
			if (typeof imgs === 'object' && Object.prototype.toString.call(imgs) === '[object Array]') {
				[].forEach.call(imgs, function(img) {
					(function() {
						var src = $(img).attr("data-src");
						if (src) {
							show(img, src);
						}
					})(img);
					
				});
			} else {
				var src = $(imgs).attr("data-src");
				if (src) {
					show(imgs, src);
				}
			}
		},
		// x 减去的额外高度 y 均分的份数
		calcSepHeight: function(x, y, direction) {
			var dir = direction || "a"; // a垂直 h 水平
			var args = Array.prototype.slice.call(arguments);
			var width, height;
			if (!!args[args.length - 1] && typeof args[args.length - 1] === 'object') {
				width = $(args[args.length - 1]).width();
				height = $(args[args.length - 1]).height();
			} else {
				width = $(window).width();
				height = $(window).height();
			}
			if(dir === 'a') {
				return (height - x) / y;
			} else if (dir === 'h') {
				return (width - x) / y;
			}
			
		},
		timeFormat: function(time) {
			var time = new Date(time);
			function check(num) {
				if (parseInt(num) < 10) {
					return "0" + num;
				} else {
					return "" + num;
 				}
			}
			return ""
				+ time.getFullYear() + "-"
				+ check(time.getMonth() + 1) + "-"
				+ check(time.getDate()) + " "
				+ check(time.getHours()) + ":"
				+ check(time.getMinutes()) + ":"
				+ check(time.getSeconds());
		}
	};
	var Tools = Tools;
	return Tools;
});
/*==================================================
 Copyright (c) 2013-2015 司徒正美 and other contributors
 http://www.cnblogs.com/rubylouvre/
 https://github.com/RubyLouvre
 http://weibo.com/jslouvre/
 
 Released under the MIT license
 avalon.modern.shim.js 1.5.5 built in 2015.11.12
 support IE10+ and other browsers
 ==================================================*/
(function(global, factory) {

    if (typeof module === "object" && typeof module.exports === "object") {
        // For CommonJS and CommonJS-like environments where a proper `window`
        // is present, execute the factory and get avalon.
        // For environments that do not have a `window` with a `document`
        // (such as Node.js), expose a factory as module.exports.
        // This accentuates the need for the creation of a real `window`.
        // e.g. var avalon = require("avalon")(window);
        module.exports = global.document ? factory(global, true) : function(w) {
            if (!w.document) {
                throw new Error("Avalon requires a window with a document")
            }
            return factory(w)
        }
    } else {
        factory(global)
    }

// Pass this if window is not defined yet
}(typeof window !== "undefined" ? window : this, function(window, noGlobal){

/*********************************************************************
 *                    全局变量及方法                                  *
 **********************************************************************/
var expose = Date.now()
//http://stackoverflow.com/questions/7290086/javascript-use-strict-and-nicks-find-global-function
var DOC = window.document
var head = DOC.head //HEAD元素
head.insertAdjacentHTML("afterBegin", '<avalon ms-skip class="avalonHide"><style id="avalonStyle">.avalonHide{ display: none!important }</style></avalon>')
var ifGroup = head.firstChild

function log() {
    if (avalon.config.debug) {
// http://stackoverflow.com/questions/8785624/how-to-safely-wrap-console-log
        console.log.apply(console, arguments)
    }
}
/**
 * Creates a new object without a prototype. This object is useful for lookup without having to
 * guard against prototypically inherited properties via hasOwnProperty.
 *
 * Related micro-benchmarks:
 * - http://jsperf.com/object-create2
 * - http://jsperf.com/proto-map-lookup/2
 * - http://jsperf.com/for-in-vs-object-keys2
 */
function createMap() {
  return Object.create(null)
}

var subscribers = "$" + expose

var nullObject = {} //作用类似于noop，只用于代码防御，千万不要在它上面添加属性
var rword = /[^, ]+/g //切割字符串为一个个小块，以空格或豆号分开它们，结合replace实现字符串的forEach
var rw20g = /\w+/g
var rsvg = /^\[object SVG\w*Element\]$/
var rwindow = /^\[object (?:Window|DOMWindow|global)\]$/
var oproto = Object.prototype
var ohasOwn = oproto.hasOwnProperty
var serialize = oproto.toString
var ap = Array.prototype
var aslice = ap.slice
var W3C = window.dispatchEvent
var root = DOC.documentElement
var avalonFragment = DOC.createDocumentFragment()
var cinerator = DOC.createElement("div")
var class2type = {}
"Boolean Number String Function Array Date RegExp Object Error".replace(rword, function (name) {
    class2type["[object " + name + "]"] = name.toLowerCase()
})
function scpCompile(array){
    return Function.apply(noop,array)
}
function noop(){}

function oneObject(array, val) {
    if (typeof array === "string") {
        array = array.match(rword) || []
    }
    var result = {},
            value = val !== void 0 ? val : 1
    for (var i = 0, n = array.length; i < n; i++) {
        result[array[i]] = value
    }
    return result
}

//生成UUID http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
var generateID = function (prefix) {
    prefix = prefix || "avalon"
    return String(Math.random() + Math.random()).replace(/\d\.\d{4}/, prefix)
}
function IE() {
    if (window.VBArray) {
        var mode = document.documentMode
        return mode ? mode : window.XMLHttpRequest ? 7 : 6
    } else {
        return NaN
    }
}
var IEVersion = IE()

avalon = function (el) { //创建jQuery式的无new 实例化结构
    return new avalon.init(el)
}


/*视浏览器情况采用最快的异步回调*/
avalon.nextTick = new function () {// jshint ignore:line
    var tickImmediate = window.setImmediate
    var tickObserver = window.MutationObserver
    if (tickImmediate) {
        return tickImmediate.bind(window)
    }

    var queue = []
    function callback() {
        var n = queue.length
        for (var i = 0; i < n; i++) {
            queue[i]()
        }
        queue = queue.slice(n)
    }

    if (tickObserver) {
        var node = document.createTextNode("avalon")
        new tickObserver(callback).observe(node, {characterData: true})// jshint ignore:line
        var bool = false
        return function (fn) {
            queue.push(fn)
            bool = !bool
            node.data = bool
        }
    }


    return function (fn) {
        setTimeout(fn, 4)
    }
}// jshint ignore:line
/*********************************************************************
 *                 avalon的静态方法定义区                              *
 **********************************************************************/
avalon.init = function (el) {
    this[0] = this.element = el
}
avalon.fn = avalon.prototype = avalon.init.prototype

avalon.type = function (obj) { //取得目标的类型
    if (obj == null) {
        return String(obj)
    }
    // 早期的webkit内核浏览器实现了已废弃的ecma262v4标准，可以将正则字面量当作函数使用，因此typeof在判定正则时会返回function
    return typeof obj === "object" || typeof obj === "function" ?
            class2type[serialize.call(obj)] || "object" :
            typeof obj
}

var isFunction = function (fn) {
    return serialize.call(fn) === "[object Function]"
}

avalon.isFunction = isFunction

avalon.isWindow = function (obj) {
    return rwindow.test(serialize.call(obj))
}

/*判定是否是一个朴素的javascript对象（Object），不是DOM对象，不是BOM对象，不是自定义类的实例*/

avalon.isPlainObject = function (obj) {
    // 简单的 typeof obj === "object"检测，会致使用isPlainObject(window)在opera下通不过
    return serialize.call(obj) === "[object Object]" && Object.getPrototypeOf(obj) === oproto
}

//与jQuery.extend方法，可用于浅拷贝，深拷贝
avalon.mix = avalon.fn.mix = function () {
    var options, name, src, copy, copyIsArray, clone,
            target = arguments[0] || {},
            i = 1,
            length = arguments.length,
            deep = false

    // 如果第一个参数为布尔,判定是否深拷贝
    if (typeof target === "boolean") {
        deep = target
        target = arguments[1] || {}
        i++
    }

    //确保接受方为一个复杂的数据类型
    if (typeof target !== "object" && !isFunction(target)) {
        target = {}
    }

    //如果只有一个参数，那么新成员添加于mix所在的对象上
    if (i === length) {
        target = this
        i--
    }

    for (; i < length; i++) {
        //只处理非空参数
        if ((options = arguments[i]) != null) {
            for (name in options) {
                src = target[name]
                copy = options[name]
                // 防止环引用
                if (target === copy) {
                    continue
                }
                if (deep && copy && (avalon.isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {

                    if (copyIsArray) {
                        copyIsArray = false
                        clone = src && Array.isArray(src) ? src : []

                    } else {
                        clone = src && avalon.isPlainObject(src) ? src : {}
                    }

                    target[name] = avalon.mix(deep, clone, copy)
                } else if (copy !== void 0) {
                    target[name] = copy
                }
            }
        }
    }
    return target
}

function _number(a, len) { //用于模拟slice, splice的效果
    a = Math.floor(a) || 0
    return a < 0 ? Math.max(len + a, 0) : Math.min(a, len);
}
avalon.mix({
    rword: rword,
    subscribers: subscribers,
    version: 1.55,
    ui: {},
    log: log,
    slice: function (nodes, start, end) {
        return aslice.call(nodes, start, end)
    },
    noop: noop,
    /*如果不用Error对象封装一下，str在控制台下可能会乱码*/
    error: function (str, e) {
        throw new (e || Error)(str)// jshint ignore:line
    },
    /*将一个以空格或逗号隔开的字符串或数组,转换成一个键值都为1的对象*/
    oneObject: oneObject,
    /* avalon.range(10)
     => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
     avalon.range(1, 11)
     => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
     avalon.range(0, 30, 5)
     => [0, 5, 10, 15, 20, 25]
     avalon.range(0, -10, -1)
     => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
     avalon.range(0)
     => []*/
    range: function (start, end, step) { // 用于生成整数数组
        step || (step = 1)
        if (end == null) {
            end = start || 0
            start = 0
        }
        var index = -1,
                length = Math.max(0, Math.ceil((end - start) / step)),
                result = new Array(length)
        while (++index < length) {
            result[index] = start
            start += step
        }
        return result
    },
    eventHooks: {},
    /*绑定事件*/
    bind: function (el, type, fn, phase) {
        var hooks = avalon.eventHooks
        var hook = hooks[type]
        if (typeof hook === "object") {
            type = hook.type || type
            phase = hook.phase || !!phase
            fn = hook.fn ? hook.fn(el, fn) : fn
        }
        el.addEventListener(type, fn, phase)
        return fn
    },
    /*卸载事件*/
    unbind: function (el, type, fn, phase) {
        var hooks = avalon.eventHooks
        var hook = hooks[type]
        var callback = fn || noop
        if (typeof hook === "object") {
            type = hook.type || type
            phase = hook.phase || !!phase
        }
        el.removeEventListener(type, callback, phase)
    },
    /*读写删除元素节点的样式*/
    css: function (node, name, value) {
        if (node instanceof avalon) {
            node = node[0]
        }
        var prop = /[_-]/.test(name) ? camelize(name) : name, fn
        name = avalon.cssName(prop) || prop
        if (value === void 0 || typeof value === "boolean") { //获取样式
            fn = cssHooks[prop + ":get"] || cssHooks["@:get"]
            if (name === "background") {
                name = "backgroundColor"
            }
            var val = fn(node, name)
            return value === true ? parseFloat(val) || 0 : val
        } else if (value === "") { //请除样式
            node.style[name] = ""
        } else { //设置样式
            if (value == null || value !== value) {
                return
            }
            if (isFinite(value) && !avalon.cssNumber[prop]) {
                value += "px"
            }
            fn = cssHooks[prop + ":set"] || cssHooks["@:set"]
            fn(node, name, value)
        }
    },
    /*遍历数组与对象,回调的第一个参数为索引或键名,第二个或元素或键值*/
    each: function (obj, fn) {
        if (obj) { //排除null, undefined
            var i = 0
            if (isArrayLike(obj)) {
                for (var n = obj.length; i < n; i++) {
                    if (fn(i, obj[i]) === false)
                        break
                }
            } else {
                for (i in obj) {
                    if (obj.hasOwnProperty(i) && fn(i, obj[i]) === false) {
                        break
                    }
                }
            }
        }
    },
    //收集元素的data-{{prefix}}-*属性，并转换为对象
    getWidgetData: function (elem, prefix) {
        var raw = avalon(elem).data()
        var result = {}
        for (var i in raw) {
            if (i.indexOf(prefix) === 0) {
                result[i.replace(prefix, "").replace(/\w/, function (a) {
                    return a.toLowerCase()
                })] = raw[i]
            }
        }
        return result
    },
    Array: {
        /*只有当前数组不存在此元素时只添加它*/
        ensure: function (target, item) {
            if (target.indexOf(item) === -1) {
                return target.push(item)
            }
        },
        /*移除数组中指定位置的元素，返回布尔表示成功与否*/
        removeAt: function (target, index) {
            return !!target.splice(index, 1).length
        },
        /*移除数组中第一个匹配传参的那个元素，返回布尔表示成功与否*/
        remove: function (target, item) {
            var index = target.indexOf(item)
            if (~index)
                return avalon.Array.removeAt(target, index)
            return false
        }
    }
})

var bindingHandlers = avalon.bindingHandlers = {}
var bindingExecutors = avalon.bindingExecutors = {}

var directives = avalon.directives = {}
avalon.directive = function (name, obj) {
    bindingHandlers[name] = obj.init = (obj.init || noop)
    bindingExecutors[name] = obj.update = (obj.update || noop)

    return directives[name] = obj
}
/*判定是否类数组，如节点集合，纯数组，arguments与拥有非负整数的length属性的纯JS对象*/
function isArrayLike(obj) {
    if (obj && typeof obj === "object") {
        var n = obj.length,
                str = serialize.call(obj)
        if (/(Array|List|Collection|Map|Arguments)\]$/.test(str)) {
            return true
        } else if (str === "[object Object]" && n === (n >>> 0)) {
            return true //由于ecma262v5能修改对象属性的enumerable，因此不能用propertyIsEnumerable来判定了
        }
    }
    return false
}


// https://github.com/rsms/js-lru
var Cache = new function() {// jshint ignore:line
    function LRU(maxLength) {
        this.size = 0
        this.limit = maxLength
        this.head = this.tail = void 0
        this._keymap = {}
    }

    var p = LRU.prototype

    p.put = function(key, value) {
        var entry = {
            key: key,
            value: value
        }
        this._keymap[key] = entry
        if (this.tail) {
            this.tail.newer = entry
            entry.older = this.tail
        } else {
            this.head = entry
        }
        this.tail = entry
        if (this.size === this.limit) {
            this.shift()
        } else {
            this.size++
        }
        return value
    }

    p.shift = function() {
        var entry = this.head
        if (entry) {
            this.head = this.head.newer
            this.head.older =
                    entry.newer =
                    entry.older =
                    this._keymap[entry.key] = void 0
             delete this._keymap[entry.key] //#1029
        }
    }
    p.get = function(key) {
        var entry = this._keymap[key]
        if (entry === void 0)
            return
        if (entry === this.tail) {
            return  entry.value
        }
        // HEAD--------------TAIL
        //   <.older   .newer>
        //  <--- add direction --
        //   A  B  C  <D>  E
        if (entry.newer) {
            if (entry === this.head) {
                this.head = entry.newer
            }
            entry.newer.older = entry.older // C <-- E.
        }
        if (entry.older) {
            entry.older.newer = entry.newer // C. --> E
        }
        entry.newer = void 0 // D --x
        entry.older = this.tail // D. --> E
        if (this.tail) {
            this.tail.newer = entry // E. <-- D
        }
        this.tail = entry
        return entry.value
    }
    return LRU
}// jshint ignore:line

/*********************************************************************
 *                           DOM 底层补丁                             *
 **********************************************************************/
//safari5+是把contains方法放在Element.prototype上而不是Node.prototype
if (!DOC.contains) {
    Node.prototype.contains = function (arg) {
        return !!(this.compareDocumentPosition(arg) & 16)
    }
}
avalon.contains = function (root, el) {
    try {
        while ((el = el.parentNode))
            if (el === root)
                return true
        return false
    } catch (e) {
        return false
    }
}

if (window.SVGElement) {
    var svgns = "http://www.w3.org/2000/svg"
    var svg = DOC.createElementNS(svgns, "svg")
    svg.innerHTML = '<circle cx="50" cy="50" r="40" fill="red" />'
    if (!rsvg.test(svg.firstChild)) {// #409
        /* jshint ignore:start */
        function enumerateNode(node, targetNode) {
            if (node && node.childNodes) {
                var nodes = node.childNodes
                for (var i = 0, el; el = nodes[i++]; ) {
                    if (el.tagName) {
                        var svg = DOC.createElementNS(svgns,
                                el.tagName.toLowerCase())
                        // copy attrs
                        ap.forEach.call(el.attributes, function (attr) {
                            svg.setAttribute(attr.name, attr.value)
                        })
                        // 递归处理子节点
                        enumerateNode(el, svg)
                        targetNode.appendChild(svg)
                    }
                }
            }
        }
        /* jshint ignore:end */
        Object.defineProperties(SVGElement.prototype, {
            "outerHTML": {//IE9-11,firefox不支持SVG元素的innerHTML,outerHTML属性
                enumerable: true,
                configurable: true,
                get: function () {
                    return new XMLSerializer().serializeToString(this)
                },
                set: function (html) {
                    var tagName = this.tagName.toLowerCase(),
                            par = this.parentNode,
                            frag = avalon.parseHTML(html)
                    // 操作的svg，直接插入
                    if (tagName === "svg") {
                        par.insertBefore(frag, this)
                        // svg节点的子节点类似
                    } else {
                        var newFrag = DOC.createDocumentFragment()
                        enumerateNode(frag, newFrag)
                        par.insertBefore(newFrag, this)
                    }
                    par.removeChild(this)
                }
            },
            "innerHTML": {
                enumerable: true,
                configurable: true,
                get: function () {
                    var s = this.outerHTML
                    var ropen = new RegExp("<" + this.nodeName + '\\b(?:(["\'])[^"]*?(\\1)|[^>])*>', "i")
                    var rclose = new RegExp("<\/" + this.nodeName + ">$", "i")
                    return  s.replace(ropen, "").replace(rclose, "")
                },
                set: function (html) {
                    if (avalon.clearHTML) {
                        avalon.clearHTML(this)
                        var frag = avalon.parseHTML(html)
                        enumerateNode(frag, this)
                    }
                }
            }
        })
    }
}
//========================= event binding ====================
var eventHooks = avalon.eventHooks
//针对firefox, chrome修正mouseenter, mouseleave(chrome30+)
if (!("onmouseenter" in root)) {
    avalon.each({
        mouseenter: "mouseover",
        mouseleave: "mouseout"
    }, function (origType, fixType) {
        eventHooks[origType] = {
            type: fixType,
            fn: function (elem, fn) {
                return function (e) {
                    var t = e.relatedTarget
                    if (!t || (t !== elem && !(elem.compareDocumentPosition(t) & 16))) {
                        delete e.type
                        e.type = origType
                        return fn.call(elem, e)
                    }
                }
            }
        }
    })
}
//针对IE9+, w3c修正animationend
avalon.each({
    AnimationEvent: "animationend",
    WebKitAnimationEvent: "webkitAnimationEnd"
}, function (construct, fixType) {
    if (window[construct] && !eventHooks.animationend) {
        eventHooks.animationend = {
            type: fixType
        }
    }
})

if (DOC.onmousewheel === void 0) {
    /* IE6-11 chrome mousewheel wheelDetla 下 -120 上 120
     firefox DOMMouseScroll detail 下3 上-3
     firefox wheel detlaY 下3 上-3
     IE9-11 wheel deltaY 下40 上-40
     chrome wheel deltaY 下100 上-100 */
    eventHooks.mousewheel = {
        type: "wheel",
        fn: function (elem, fn) {
            return function (e) {
                e.wheelDeltaY = e.wheelDelta = e.deltaY > 0 ? -120 : 120
                e.wheelDeltaX = 0
                Object.defineProperty(e, "type", {
                    value: "mousewheel"
                })
                fn.call(elem, e)
            }
        }
    }
}
/*********************************************************************
 *                           配置系统                                 *
 **********************************************************************/

function kernel(settings) {
    for (var p in settings) {
        if (!ohasOwn.call(settings, p))
            continue
        var val = settings[p]
        if (typeof kernel.plugins[p] === "function") {
            kernel.plugins[p](val)
        } else if (typeof kernel[p] === "object") {
            avalon.mix(kernel[p], val)
        } else {
            kernel[p] = val
        }
    }
    return this
}
var openTag, closeTag, rexpr, rexprg, rbind, rregexp = /[-.*+?^${}()|[\]\/\\]/g

function escapeRegExp(target) {
    //http://stevenlevithan.com/regex/xregexp/
    //将字符串安全格式化为正则表达式的源码
    return (target + "").replace(rregexp, "\\$&")
}

var plugins = {
    interpolate: function (array) {
        openTag = array[0]
        closeTag = array[1]
        if (openTag === closeTag) {
            throw new SyntaxError("openTag!==closeTag")
            var test = openTag + "test" + closeTag
            cinerator.innerHTML = test
            if (cinerator.innerHTML !== test && cinerator.innerHTML.indexOf("&lt;") > -1) {
                throw new SyntaxError("此定界符不合法")
            }
            cinerator.innerHTML = ""
        }
         kernel.openTag = openTag
            kernel.closeTag = closeTag
        var o = escapeRegExp(openTag),
                c = escapeRegExp(closeTag)
        rexpr = new RegExp(o + "(.*?)" + c)
        rexprg = new RegExp(o + "(.*?)" + c, "g")
        rbind = new RegExp(o + ".*?" + c + "|\\sms-")
    }
}
kernel.async =true
kernel.debug = true
kernel.plugins = plugins
kernel.plugins['interpolate'](["{{", "}}"])
kernel.paths = {}
kernel.shim = {}
kernel.maxRepeatSize = 100
avalon.config = kernel
function $watch(expr, binding) {
    var $events = this.$events || (this.$events = {})

    var queue = $events[expr] || ($events[expr] = [])
    if (typeof binding === "function") {
        var backup = binding
        backup.uniqueNumber = Math.random()
        binding = {
            element: root,
            type: "user-watcher",
            handler: noop,
            vmodels: [this],
            expr: expr,
            uniqueNumber: backup.uniqueNumber
        }
        binding.wildcard = /\*/.test(expr)
    }

    if (!binding.update) {
        if (/\w\.*\B/.test(expr)) {
            binding.getter = noop
            var host = this
            binding.update = function () {
                var args = this.fireArgs || []
                if (args[2])
                    binding.handler.apply(host, args)
                delete this.fireArgs
            }
            queue.sync = true
            avalon.Array.ensure(queue, binding)
        } else {
            avalon.injectBinding(binding)
        }
        if (backup) {
            binding.handler = backup
        }
    } else if (!binding.oneTime) {
        avalon.Array.ensure(queue, binding)
    }
    return function () {
        binding.update = binding.getter = binding.handler = noop
        binding.element = DOC.createElement("a")
    }
}
function $emit(key, args) {
    var event = this.$events
    if (event && event[key]) {
        if (args) {
            args[2] = key
        }
        var arr = event[key]
        notifySubscribers(arr, args)
        var parent = this.$up
        if (parent) {
            if (this.$pathname) {
                $emit.call(parent, this.$pathname + "." + key, args)//以确切的值往上冒泡
            }

            $emit.call(parent, "*." + key, args)//以模糊的值往上冒泡
        }
    } else {
        parent = this.$up
       
        if(this.$ups ){
            for(var i in this.$ups){
                $emit.call(this.$ups[i], i+"."+key, args)//以确切的值往上冒泡
            }
            return
        }
        if (parent) {
            var p = this.$pathname
            if (p === "")
                p = "*"
            var path = p + "." + key
            arr = path.split(".")
            if (arr.indexOf("*") === -1) {
                $emit.call(parent, path, args)//以确切的值往上冒泡
                arr[1] = "*"
                $emit.call(parent, arr.join("."), args)//以模糊的值往上冒泡
            } else {
                $emit.call(parent, path, args)//以确切的值往上冒泡
            }
        }
    }
}


function collectDependency(el, key) {
    do {
        if (el.$watch) {
            var e = el.$events || (el.$events = {})
            var array = e[key] || (e[key] = [])
            dependencyDetection.collectDependency(array)
            return
        }
        el = el.$up
        if (el) {
            key = el.$pathname + "." + key
        } else {
            break
        }

    } while (true)
}


function notifySubscribers(subs, args) {
    if (!subs)
        return
    if (new Date() - beginTime > 444 && typeof subs[0] === "object") {
        rejectDisposeQueue()
    }
    var users = [], renders = []
    for (var i = 0, sub; sub = subs[i++]; ) {
        if (sub.type === "user-watcher") {
            users.push(sub)
        } else {
            renders.push(sub)
        }

    }
    if (kernel.async) {
        buffer.render()//1
        for (i = 0; sub = renders[i++]; ) {
            if (sub.update) {
                var uuid = getUid(sub)
                if (!buffer.queue[uuid]) {
                    buffer.queue[uuid] = 1
                    buffer.queue.push(sub)
                }
            }
        }
    } else {
        for (i = 0; sub = renders[i++]; ) {
            if (sub.update) {
                sub.update()//最小化刷新DOM树
            }
        }
    }
    for (i = 0; sub = users[i++]; ) {
        if (args && args[2] === sub.expr || sub.wildcard) {
            sub.fireArgs = args
        }
        sub.update()
    }
}
//avalon最核心的方法的两个方法之一（另一个是avalon.scan），返回一个ViewModel(VM)
var VMODELS = avalon.vmodels = {} //所有vmodel都储存在这里
avalon.define = function (source) {
    var $id = source.$id
    if (!$id) {
        log("warning: vm必须指定$id")
    }
    var vmodel = modelFactory(source)
    vmodel.$id = $id
    return VMODELS[$id] = vmodel
}

//一些不需要被监听的属性
var $$skipArray = oneObject("$id,$watch,$fire,$events,$model,$skipArray,$active,$pathname,$up,$ups,$track,$accessors")

//如果浏览器不支持ecma262v5的Object.defineProperties或者存在BUG，比如IE8
//标准浏览器使用__defineGetter__, __defineSetter__实现

function modelFactory(source, options) {
    options = options || {}
    options.watch = true
    return observeObject(source, options)
}

//监听对象属性值的变化(注意,数组元素不是数组的属性),通过对劫持当前对象的访问器实现
//监听对象或数组的结构变化, 对对象的键值对进行增删重排, 或对数组的进行增删重排,都属于这范畴
//   通过比较前后代理VM顺序实现
function Component() {
}

function observeObject(source, options) {
    if (!source || (source.$id && source.$accessors) || (source.nodeName && source.nodeType > 0)) {
        return source
    }
    //source为原对象,不能是元素节点或null
    //options,可选,配置对象,里面有old, force, watch这三个属性
    options = options || nullObject
    var force = options.force || nullObject
    var old = options.old
    var oldAccessors = old && old.$accessors || nullObject
    var $vmodel = new Component() //要返回的对象, 它在IE6-8下可能被偷龙转凤
    var accessors = {} //监控属性
    var hasOwn = {}
    var skip = []
    var simple = []
    var $skipArray = {}
    if (source.$skipArray) {
        $skipArray = oneObject(source.$skipArray)
        delete source.$skipArray
    }
    //处理计算属性
    var computed = source.$computed
    if (computed) {
        delete source.$computed
        for (var name in computed) {
            hasOwn[name] = true;
            (function (key, value) {
                var old
                accessors[key] = {
                    get: function () {
                        return old = value.get.call(this)
                    },
                    set: function (x) {
                        if (typeof value.set === "function") {
                            var older = old
                            value.set.call(this, x)
                            var newer = this[key]
                            if (this.$fire && (newer !== older)) {
                                this.$fire(key, newer, older)
                            }
                        }
                    },
                    enumerable: true,
                    configurable: true
                }
            })(name, computed[name])// jshint ignore:line
        }
    }


    for (name in source) {
        var value = source[name]
        if (!$$skipArray[name])
            hasOwn[name] = true
        if (typeof value === "function" || (value && value.nodeName && value.nodeType > 0) ||
                (!force[name] && (name.charAt(0) === "$" || $$skipArray[name] || $skipArray[name]))) {
            skip.push(name)
        } else if (isComputed(value)) {
            log("warning:计算属性建议放在$computed对象中统一定义");
            (function (key, value) {
                var old
                accessors[key] = {
                    get: function () {
                        return old = value.get.call(this)
                    },
                    set: function (x) {
                        if (typeof value.set === "function") {
                            var older = old
                            value.set.call(this, x)
                            var newer = this[key]
                            if (this.$fire && (newer !== older)) {
                                this.$fire(key, newer, older)
                            }
                        }
                    },
                    enumerable: true,
                    configurable: true
                }
            })(name, value)// jshint ignore:line
        } else {
            simple.push(name)
            if (oldAccessors[name]) {
                accessors[name] = oldAccessors[name]
            } else {
                accessors[name] = makeGetSet(name, value)
            }
        }
    }


    accessors["$model"] = $modelDescriptor
    $vmodel = Object.defineProperties($vmodel, accessors, source)
    function trackBy(name) {
        return hasOwn[name] === true
    }
    skip.forEach(function (name) {
        $vmodel[name] = source[name]
    })

    /* jshint ignore:start */
    hideProperty($vmodel, "$ups", null)
    hideProperty($vmodel, "$id", "anonymous")
    hideProperty($vmodel, "$up", old ? old.$up : null)
    hideProperty($vmodel, "$track", Object.keys(hasOwn))
    hideProperty($vmodel, "$active", false)
    hideProperty($vmodel, "$pathname", old ? old.$pathname : "")
    hideProperty($vmodel, "$accessors", accessors)
    hideProperty($vmodel, "hasOwnProperty", trackBy)
    if (options.watch) {
        hideProperty($vmodel, "$watch", function () {
            return $watch.apply($vmodel, arguments)
        })
        hideProperty($vmodel, "$fire", function (path, a) {
            if (path.indexOf("all!") === 0) {
                var ee = path.slice(4)
                for (var i in avalon.vmodels) {
                    var v = avalon.vmodels[i]
                    v.$fire && v.$fire.apply(v, [ee, a])
                }
            } else {
                $emit.call($vmodel, path, [a])
            }
        })
    }
    /* jshint ignore:end */

    //必须设置了$active,$events
    simple.forEach(function (name) {
        var oldVal = old && old[name]
        var val = $vmodel[name] = source[name]
        if (val && typeof val === "object") {
            val.$up = $vmodel
            val.$pathname = name
        }
        $emit.call($vmodel, name,[val,oldVal])
    })
    for (name in computed) {
        value = $vmodel[name]
    }
    $vmodel.$active = true
    return $vmodel
}
/*
 新的VM拥有如下私有属性
 $id: vm.id
 $events: 放置$watch回调与绑定对象
 $watch: 增强版$watch
 $fire: 触发$watch回调
 $track:一个数组,里面包含用户定义的所有键名
 $active:boolean,false时防止依赖收集
 $model:返回一个纯净的JS对象
 $accessors:放置所有读写器的数据描述对象
 $up:返回其上级对象
 $pathname:返回此对象在上级对象的名字,注意,数组元素的$pathname为空字符串
 =============================
 $skipArray:用于指定不可监听的属性,但VM生成是没有此属性的
 */
function isComputed(val) {//speed up!
    if (val && typeof val === "object") {
        for (var i in val) {
            if (i !== "get" && i !== "set") {
                return false
            }
        }
        return  typeof val.get === "function"
    }
}
function makeGetSet(key, value) {
    var childVm, value = NaN
    return {
        get: function () {
            if (this.$active) {
                collectDependency(this, key)
            }
            return value
        },
        set: function (newVal) {
            if (value === newVal)
                return
            var oldValue = value
            childVm = observe(newVal, value)
            if (childVm) {
                value = childVm
            } else {
                childVm = void 0
                value = newVal
            }

            if (Object(childVm) === childVm) {
                childVm.$pathname = key
                childVm.$up = this
            }
            if (this.$active) {
                $emit.call(this, key, [value, oldValue])
            }
        },
        enumerable: true,
        configurable: true
    }
}

function observe(obj, old, hasReturn, watch) {
    if (Array.isArray(obj)) {
        return observeArray(obj, old, watch)
    } else if (avalon.isPlainObject(obj)) {
        if (old && typeof old === 'object') {
            var keys = Object.keys(obj)
            var keys2 = Object.keys(old)
            if (keys.join(";") === keys2.join(";")) {
                for (var i in obj) {
                    if (obj.hasOwnProperty(i)) {
                        old[i] = obj[i]
                    }
                }
                return old
            }
            old.$active = false
        }
        return observeObject(obj, {
            old: old,
            watch: watch
        })
    }
    if (hasReturn) {
        return obj
    }
}

function observeArray(array, old, watch) {
    if (old) {
        var args = [0, old.length].concat(array)
        old.splice.apply(old, args)
        return old
    } else {
        for (var i in newProto) {
            array[i] = newProto[i]
        }
        hideProperty(array, "$up", null)
        hideProperty(array, "$pathname", "")
        hideProperty(array, "$track", createTrack(array.length))

        array._ = observeObject({
            length: NaN
        }, {
            watch: true
        })
        array._.length = array.length
        array._.$watch("length", function (a, b) {
            $emit.call(array.$up, array.$pathname + ".length", [a, b])
        })
        if (watch) {
            hideProperty(array, "$watch", function () {
                return $watch.apply(array, arguments)
            })
        }


        Object.defineProperty(array, "$model", $modelDescriptor)

        for (var j = 0, n = array.length; j < n; j++) {
            var el = array[j] = observe(array[j], 0, 1, 1)
            if (Object(el) === el) {//#1077
                el.$up = array
            }
        }

        return array
    }
}

function hideProperty(host, name, value) {

    Object.defineProperty(host, name, {
        value: value,
        writable: true,
        enumerable: false,
        configurable: true
    })

}

function toJson(val) {
    var xtype = avalon.type(val)
    if (xtype === "array") {
        var array = []
        for (var i = 0; i < val.length; i++) {
            array[i] = toJson(val[i])
        }
        return array
    } else if (xtype === "object") {
        var obj = {}
        for (i in val) {
            if (val.hasOwnProperty(i)) {
                var value = val[i]
                obj[i] = value && value.nodeType ? value : toJson(value)
            }
        }
        return obj
    }
    return val
}

var $modelDescriptor = {
    get: function () {
        return toJson(this)
    },
    set: noop,
    enumerable: false,
    configurable: true
}


/*********************************************************************
 *          监控数组（与ms-each, ms-repeat配合使用）                     *
 **********************************************************************/

var arrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice']
var arrayProto = Array.prototype
var newProto = {
    notify: function () {
        $emit.call(this.$up, this.$pathname)
    },
    set: function (index, val) {
        if (((index >>> 0) === index) && this[index] !== val) {
            if (index > this.length) {
                throw Error(index + "set方法的第一个参数不能大于原数组长度")
            }
            $emit.call(this.$up, this.$pathname + ".*", [val, this[index]])
            this.splice(index, 1, val)
        }
    },
    contains: function (el) { //判定是否包含
        return this.indexOf(el) !== -1
    },
    ensure: function (el) {
        if (!this.contains(el)) { //只有不存在才push
            this.push(el)
        }
        return this
    },
    pushArray: function (arr) {
        return this.push.apply(this, arr)
    },
    remove: function (el) { //移除第一个等于给定值的元素
        return this.removeAt(this.indexOf(el))
    },
    removeAt: function (index) { //移除指定索引上的元素
        if ((index >>> 0) === index) {
            return this.splice(index, 1)
        }
        return []
    },
    size: function () { //取得数组长度，这个函数可以同步视图，length不能
        return this._.length
    },
    removeAll: function (all) { //移除N个元素
        if (Array.isArray(all)) {
            for (var i = this.length - 1; i >= 0; i--) {
                if (all.indexOf(this[i]) !== -1) {
                    _splice.call(this.$track, i, 1)
                    _splice.call(this, i, 1)
                    
                }
            }
        } else if (typeof all === "function") {
            for (i = this.length - 1; i >= 0; i--) {
                var el = this[i]
                if (all(el, i)) {
                     _splice.call(this.$track, i, 1)
                    _splice.call(this, i, 1)
                   
                }
            }
        } else {
            _splice.call(this.$track, 0, this.length)
            _splice.call(this, 0, this.length)

        }
        if (!W3C) {
            this.$model = toJson(this)
        }
        this.notify()
        this._.length = this.length
    },
    clear: function () {
        return this.removeAll()
    }
}
var _splice = arrayProto.splice
arrayMethods.forEach(function (method) {
    var original = arrayProto[method]
    newProto[method] = function () {
        // 继续尝试劫持数组元素的属性
        var args = []
        for (var i = 0, n = arguments.length; i < n; i++) {
            args[i] = observe(arguments[i], 0, 1, 1)
        }
        var result = original.apply(this, args)
        addTrack(this.$track, method, args)
        if (!W3C) {
            this.$model = toJson(this)
        }
        this.notify()
        this._.length = this.length
        return result
    }
})

"sort,reverse".replace(rword, function (method) {
    newProto[method] = function () {
        var oldArray = this.concat() //保持原来状态的旧数组
        var newArray = this
        var mask = Math.random()
        var indexes = []
        var hasSort = false
        arrayProto[method].apply(newArray, arguments) //排序
        for (var i = 0, n = oldArray.length; i < n; i++) {
            var neo = newArray[i]
            var old = oldArray[i]
            if (neo === old) {
                indexes.push(i)
            } else {
                var index = oldArray.indexOf(neo)
                indexes.push(index)//得到新数组的每个元素在旧数组对应的位置
                oldArray[index] = mask    //屏蔽已经找过的元素
                hasSort = true
            }
        }
        if (hasSort) {
            sortByIndex(this.$track, indexes)
            if (!W3C) {
                this.$model = toJson(this)
            }
            this.notify()
        }
        return this
    }
})

function sortByIndex(array, indexes) {
    var map = {};
    for (var i = 0, n = indexes.length; i < n; i++) {
        map[i] = array[i]
        var j = indexes[i]
        if (j in map) {
            array[i] = map[j]
            delete map[j]
        } else {
            array[i] = array[j]
        }
    }
}

function createTrack(n) {
    var ret = []
    for (var i = 0; i < n; i++) {
        ret[i] = generateID("$proxy$each")
    }
    return ret
}

function addTrack(track, method, args) {
    switch (method) {
        case 'push':
        case 'unshift':
            args = createTrack(args.length)
            break
        case 'splice':
            if (args.length > 2) {
                // 0, 5, a, b, c --> 0, 2, 0
                // 0, 5, a, b, c, d, e, f, g--> 0, 0, 3
                var del = args[1]
                var add = args.length - 2
                // args = [args[0], Math.max(del - add, 0)].concat(createTrack(Math.max(add - del, 0)))
                args = [args[0], args[1]].concat(createTrack(args.length - 2))
            }
            break
    }
    Array.prototype[method].apply(track, args)
}
/*********************************************************************
 *                           依赖调度系统                             *
 **********************************************************************/
//检测两个对象间的依赖关系
var dependencyDetection = (function () {
    var outerFrames = []
    var currentFrame
    return {
        begin: function (binding) {
            //accessorObject为一个拥有callback的对象
            outerFrames.push(currentFrame)
            currentFrame = binding
        },
        end: function () {
            currentFrame = outerFrames.pop()
        },
        collectDependency: function (array) {
            if (currentFrame) {
                //被dependencyDetection.begin调用
                currentFrame.callback(array)
            }
        }
    };
})()
//将绑定对象注入到其依赖项的订阅数组中
var roneval = /^on$/

function returnRandom() {
    return new Date() - 0
}

avalon.injectBinding = function (binding) {

    binding.handler = binding.handler || directives[binding.type].update || noop
    binding.update = function () {
        var begin = false
        if (!binding.getter) {
            begin = true
            dependencyDetection.begin({
                callback: function (array) {
                    injectDependency(array, binding)
                }
            })
            binding.getter = parseExpr(binding.expr, binding.vmodels, binding)
            binding.observers.forEach(function (a) {
                a.v.$watch(a.p, binding)
            })
            delete binding.observers
        }
        try {
            var args = binding.fireArgs, a, b
            delete binding.fireArgs
            if (!args) {
                if (binding.type === "on") {
                    a = binding.getter + ""
                } else {
                    a = binding.getter.apply(0, binding.args)
                }
            } else {
                a = args[0]
                b = args[1]

            }
            b = typeof b === "undefined" ? binding.oldValue : b
            if (binding._filters) {
                a = filters.$filter.apply(0, [a].concat(binding._filters))
            }
            if (binding.signature) {
                var xtype = avalon.type(a)
                if (xtype !== "array" && xtype !== "object") {
                    throw Error("warning:" + binding.expr + "只能是对象或数组")
                }
                binding.xtype = xtype
                var vtrack = getProxyIds(binding.proxies || [], xtype)
                var mtrack = a.$track || (xtype === "array" ? createTrack(a.length) :
                        Object.keys(a))
                binding.track = mtrack
                if (vtrack !== mtrack.join(";")) {
                    binding.handler(a, b)
                    binding.oldValue = 1
                }
            } else if (Array.isArray(a) ? a.length !== (b && b.length) : false) {
                binding.handler(a, b)
                binding.oldValue = a.concat()
            } else if (!("oldValue" in binding) || a !== b) {
                binding.handler(a, b)
                binding.oldValue = a
            }
        } catch (e) {
            delete binding.getter
            log("warning:exception throwed in [avalon.injectBinding] ", e)
            var node = binding.element
            if (node && node.nodeType === 3) {
                node.nodeValue = openTag + (binding.oneTime ? "::" : "") + binding.expr + closeTag
            }
        } finally {
            begin && dependencyDetection.end()

        }
    }
    binding.update()
}


//将依赖项(比它高层的访问器或构建视图刷新函数的绑定对象)注入到订阅者数组
function injectDependency(list, binding) {
    if (binding.oneTime)
        return
    if (list && avalon.Array.ensure(list, binding) && binding.element) {
        injectDisposeQueue(binding, list)
        if (new Date() - beginTime > 444) {
            rejectDisposeQueue()
        }
    }
}


function getProxyIds(a, isArray) {
    var ret = []
    for (var i = 0, el; el = a[i++]; ) {
        ret.push(isArray ? el.$id : el.$key)
    }
    return ret.join(";")
}

/*********************************************************************
 *                          定时GC回收机制                             *
 **********************************************************************/
var disposeCount = 0
var disposeQueue = avalon.$$subscribers = []
var beginTime = new Date()
var oldInfo = {}

function getUid(data) { //IE9+,标准浏览器
    if (!data.uniqueNumber) {
        var elem = data.element
        if (elem) {
            if (elem.nodeType !== 1) {
                //如果是注释节点,则data.pos不存在,当一个元素下有两个注释节点就会出问题
                data.uniqueNumber = data.type + "-" + getUid(elem.parentNode) + "-" + (++disposeCount)
            } else {
                data.uniqueNumber = data.name + "-" + getUid(elem)
            }
        } else {
            data.uniqueNumber = ++disposeCount
        }
    }
    return data.uniqueNumber
}

//添加到回收列队中
function injectDisposeQueue(data, list) {
    var lists = data.lists || (data.lists = [])
    var uuid = getUid(data)
    avalon.Array.ensure(lists, list)
    list.$uuid = list.$uuid || generateID()
    if (!disposeQueue[uuid]) {
        disposeQueue[uuid] = 1
        disposeQueue.push(data)
    }
}

function rejectDisposeQueue(data) {

    var i = disposeQueue.length
    var n = i
    var allTypes = []
    var iffishTypes = {}
    var newInfo = {}
    //对页面上所有绑定对象进行分门别类, 只检测个数发生变化的类型
    while (data = disposeQueue[--i]) {
        var type = data.type
        if (newInfo[type]) {
            newInfo[type]++
        } else {
            newInfo[type] = 1
            allTypes.push(type)
        }
    }
    var diff = false
    allTypes.forEach(function (type) {
        if (oldInfo[type] !== newInfo[type]) {
            iffishTypes[type] = 1
            diff = true
        }
    })
    i = n
    if (diff) {
        while (data = disposeQueue[--i]) {
            if (data.element === null) {
                disposeQueue.splice(i, 1)
                continue
            }
            if (iffishTypes[data.type] && shouldDispose(data.element)) { //如果它没有在DOM树
                disposeQueue.splice(i, 1)
                delete disposeQueue[data.uniqueNumber]
                var lists = data.lists
                for (var k = 0, list; list = lists[k++]; ) {
                    avalon.Array.remove(lists, list)
                    avalon.Array.remove(list, data)
                }
                disposeData(data)
            }
        }
    }
    oldInfo = newInfo
    beginTime = new Date()
}

function disposeData(data) {
    delete disposeQueue[data.uniqueNumber] // 先清除，不然无法回收了
    data.element = null
    data.rollback && data.rollback()
    for (var key in data) {
        data[key] = null
    }
}

function shouldDispose(el) {
    try {//IE下，如果文本节点脱离DOM树，访问parentNode会报错
        var fireError = el.parentNode.nodeType
    } catch (e) {
        return true
    }
    if (el.ifRemove) {
        // 如果节点被放到ifGroup，才移除
        if (!root.contains(el.ifRemove) && (ifGroup === el.parentNode)) {
            el.parentNode && el.parentNode.removeChild(el)
            return true
        }
    }
    return el.msRetain ? 0 : (el.nodeType === 1 ? !root.contains(el) : !avalon.contains(root, el))
}



/************************************************************************
 *              HTML处理(parseHTML, innerHTML, clearHTML)                 *
 **************************************************************************/
//parseHTML的辅助变量
var tagHooks = new function() {// jshint ignore:line
    avalon.mix(this, {
        option: DOC.createElement("select"),
        thead: DOC.createElement("table"),
        td: DOC.createElement("tr"),
        area: DOC.createElement("map"),
        tr: DOC.createElement("tbody"),
        col: DOC.createElement("colgroup"),
        legend: DOC.createElement("fieldset"),
        _default: DOC.createElement("div"),
        "g": DOC.createElementNS("http://www.w3.org/2000/svg", "svg")
    })
    this.optgroup = this.option
    this.tbody = this.tfoot = this.colgroup = this.caption = this.thead
    this.th = this.td
}// jshint ignore:line

String("circle,defs,ellipse,image,line,path,polygon,polyline,rect,symbol,text,use").replace(rword, function(tag) {
    tagHooks[tag] = tagHooks.g //处理SVG
})
var rtagName = /<([\w:]+)/
var rxhtml = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig
var scriptTypes = oneObject(["", "text/javascript", "text/ecmascript", "application/ecmascript", "application/javascript"])
var script = DOC.createElement("script")
var rhtml = /<|&#?\w+;/
avalon.parseHTML = function(html) {
    var fragment = avalonFragment.cloneNode(false)
    if (typeof html !== "string" ) {
        return fragment
    }
    if (!rhtml.test(html)) {
        fragment.appendChild(DOC.createTextNode(html))
        return fragment
    }
    html = html.replace(rxhtml, "<$1></$2>").trim()
    var tag = (rtagName.exec(html) || ["", ""])[1].toLowerCase(),
            //取得其标签名
            wrapper = tagHooks[tag] || tagHooks._default,
            firstChild
    wrapper.innerHTML = html
    var els = wrapper.getElementsByTagName("script")
    if (els.length) { //使用innerHTML生成的script节点不会发出请求与执行text属性
        for (var i = 0, el; el = els[i++]; ) {
            if (scriptTypes[el.type]) {
                var neo = script.cloneNode(false) //FF不能省略参数
                ap.forEach.call(el.attributes, function(attr) {
                    neo.setAttribute(attr.name, attr.value)
                })// jshint ignore:line
                neo.text = el.text
                el.parentNode.replaceChild(neo, el)
            }
        }
    }

    while (firstChild = wrapper.firstChild) { // 将wrapper上的节点转移到文档碎片上！
        fragment.appendChild(firstChild)
    }
    return fragment
}

avalon.innerHTML = function(node, html) {
    var a = this.parseHTML(html)
    this.clearHTML(node).appendChild(a)
}

avalon.clearHTML = function(node) {
    node.textContent = ""
    while (node.firstChild) {
        node.removeChild(node.firstChild)
    }
    return node
}

/*********************************************************************
 *                        avalon的原型方法定义区                        *
 **********************************************************************/

function hyphen(target) {
    //转换为连字符线风格
    return target.replace(/([a-z\d])([A-Z]+)/g, "$1-$2").toLowerCase()
}

function camelize(target) {
    //转换为驼峰风格
    if (target.indexOf("-") < 0 && target.indexOf("_") < 0) {
        return target //提前判断，提高getStyle等的效率
    }
    return target.replace(/[-_][^-_]/g, function (match) {
        return match.charAt(1).toUpperCase()
    })
}

"add,remove".replace(rword, function (method) {
    avalon.fn[method + "Class"] = function (cls) {
        var el = this[0]
        //https://developer.mozilla.org/zh-CN/docs/Mozilla/Firefox/Releases/26
        if (cls && typeof cls === "string" && el && el.nodeType === 1) {
            cls.replace(/\S+/g, function (c) {
                el.classList[method](c)
            })
        }
        return this
    }
})

avalon.fn.mix({
    hasClass: function (cls) {
        var el = this[0] || {} //IE10+, chrome8+, firefox3.6+, safari5.1+,opera11.5+支持classList,chrome24+,firefox26+支持classList2.0
        return el.nodeType === 1 && el.classList.contains(cls)
    },
    toggleClass: function (value, stateVal) {
        var className, i = 0
        var classNames = String(value).split(/\s+/)
        var isBool = typeof stateVal === "boolean"
        while ((className = classNames[i++])) {
            var state = isBool ? stateVal : !this.hasClass(className)
            this[state ? "addClass" : "removeClass"](className)
        }
        return this
    },
    attr: function (name, value) {
        if (arguments.length === 2) {
            this[0].setAttribute(name, value)
            return this
        } else {
            return this[0].getAttribute(name)
        }
    },
    data: function (name, value) {
        name = "data-" + hyphen(name || "")
        switch (arguments.length) {
            case 2:
                this.attr(name, value)
                return this
            case 1:
                var val = this.attr(name)
                return parseData(val)
            case 0:
                var ret = {}
                ap.forEach.call(this[0].attributes, function (attr) {
                    if (attr) {
                        name = attr.name
                        if (!name.indexOf("data-")) {
                            name = camelize(name.slice(5))
                            ret[name] = parseData(attr.value)
                        }
                    }
                })
                return ret
        }
    },
    removeData: function (name) {
        name = "data-" + hyphen(name)
        this[0].removeAttribute(name)
        return this
    },
    css: function (name, value) {
        if (avalon.isPlainObject(name)) {
            for (var i in name) {
                avalon.css(this, i, name[i])
            }
        } else {
            var ret = avalon.css(this, name, value)
        }
        return ret !== void 0 ? ret : this
    },
    position: function () {
        var offsetParent, offset,
                elem = this[0],
                parentOffset = {
                    top: 0,
                    left: 0
                };
        if (!elem) {
            return
        }
        if (this.css("position") === "fixed") {
            offset = elem.getBoundingClientRect()
        } else {
            offsetParent = this.offsetParent() //得到真正的offsetParent
            offset = this.offset() // 得到正确的offsetParent
            if (offsetParent[0].tagName !== "HTML") {
                parentOffset = offsetParent.offset()
            }
            parentOffset.top += avalon.css(offsetParent[0], "borderTopWidth", true)
            parentOffset.left += avalon.css(offsetParent[0], "borderLeftWidth", true)
            // Subtract offsetParent scroll positions
            parentOffset.top -= offsetParent.scrollTop()
            parentOffset.left -= offsetParent.scrollLeft()
        }
        return {
            top: offset.top - parentOffset.top - avalon.css(elem, "marginTop", true),
            left: offset.left - parentOffset.left - avalon.css(elem, "marginLeft", true)
        }
    },
    offsetParent: function () {
        var offsetParent = this[0].offsetParent
        while (offsetParent && avalon.css(offsetParent, "position") === "static") {
            offsetParent = offsetParent.offsetParent;
        }
        return avalon(offsetParent || root)
    },
    bind: function (type, fn, phase) {
        if (this[0]) { //此方法不会链
            return avalon.bind(this[0], type, fn, phase)
        }
    },
    unbind: function (type, fn, phase) {
        if (this[0]) {
            avalon.unbind(this[0], type, fn, phase)
        }
        return this
    },
    val: function (value) {
        var node = this[0]
        if (node && node.nodeType === 1) {
            var get = arguments.length === 0
            var access = get ? ":get" : ":set"
            var fn = valHooks[getValType(node) + access]
            if (fn) {
                var val = fn(node, value)
            } else if (get) {
                return (node.value || "").replace(/\r/g, "")
            } else {
                node.value = value
            }
        }
        return get ? val : this
    }
})

if (root.dataset) {
    avalon.fn.data = function (name, val) {
        name = name && camelize(name)
        var dataset = this[0].dataset
        switch (arguments.length) {
            case 2:
                dataset[name] = val
                return this
            case 1:
                val = dataset[name]
                return parseData(val)
            case 0:
                var ret = createMap()
                for (name in dataset) {
                    ret[name] = parseData(dataset[name])
                }
                return ret
        }
    }
}
var rbrace = /(?:\{[\s\S]*\}|\[[\s\S]*\])$/
avalon.parseJSON = JSON.parse

function parseData(data) {
    try {
        if (typeof data === "object")
            return data
        data = data === "true" ? true :
                data === "false" ? false :
                data === "null" ? null : +data + "" === data ? +data : rbrace.test(data) ? JSON.parse(data) : data
    } catch (e) {
    }
    return data
}

avalon.fireDom = function (elem, type, opts) {
    var hackEvent = DOC.createEvent("Events");
    hackEvent.initEvent(type, true, true)
    avalon.mix(hackEvent, opts)
    elem.dispatchEvent(hackEvent)
}

avalon.each({
    scrollLeft: "pageXOffset",
    scrollTop: "pageYOffset"
}, function (method, prop) {
    avalon.fn[method] = function (val) {
        var node = this[0] || {},
                win = getWindow(node),
                top = method === "scrollTop"
        if (!arguments.length) {
            return win ? win[prop] : node[method]
        } else {
            if (win) {
                win.scrollTo(!top ? val : win[prop], top ? val : win[prop])
            } else {
                node[method] = val
            }
        }
    }
})

function getWindow(node) {
    return node.window && node.document ? node : node.nodeType === 9 ? node.defaultView : false
}

//=============================css相关==================================
var cssHooks = avalon.cssHooks = createMap()
var prefixes = ["", "-webkit-", "-moz-", "-ms-"] //去掉opera-15的支持
var cssMap = {
    "float": "cssFloat"
}
avalon.cssNumber = oneObject("animationIterationCount,animationIterationCount,columnCount,order,flex,flexGrow,flexShrink,fillOpacity,fontWeight,lineHeight,opacity,orphans,widows,zIndex,zoom")

avalon.cssName = function (name, host, camelCase) {
    if (cssMap[name]) {
        return cssMap[name]
    }
    host = host || root.style
    for (var i = 0, n = prefixes.length; i < n; i++) {
        camelCase = camelize(prefixes[i] + name)
        if (camelCase in host) {
            return (cssMap[name] = camelCase)
        }
    }
    return null
}
cssHooks["@:set"] = function (node, name, value) {
    node.style[name] = value
}

cssHooks["@:get"] = function (node, name) {
    if (!node || !node.style) {
        throw new Error("getComputedStyle要求传入一个节点 " + node)
    }
    var ret, computed = getComputedStyle(node)
    if (computed) {
        ret = name === "filter" ? computed.getPropertyValue(name) : computed[name]
        if (ret === "") {
            ret = node.style[name] //其他浏览器需要我们手动取内联样式
        }
    }
    return ret
}
cssHooks["opacity:get"] = function (node) {
    var ret = cssHooks["@:get"](node, "opacity")
    return ret === "" ? "1" : ret
}

"top,left".replace(rword, function (name) {
    cssHooks[name + ":get"] = function (node) {
        var computed = cssHooks["@:get"](node, name)
        return /px$/.test(computed) ? computed :
                avalon(node).position()[name] + "px"
    }
})
var cssShow = {
    position: "absolute",
    visibility: "hidden",
    display: "block"
}
var rdisplayswap = /^(none|table(?!-c[ea]).+)/

function showHidden(node, array) {
    //http://www.cnblogs.com/rubylouvre/archive/2012/10/27/2742529.html
    if (node.offsetWidth <= 0) { //opera.offsetWidth可能小于0
        var styles = getComputedStyle(node, null)
        if (rdisplayswap.test(styles["display"])) {
            var obj = {
                node: node
            }
            for (var name in cssShow) {
                obj[name] = styles[name]
                node.style[name] = cssShow[name]
            }
            array.push(obj)
        }
        var parent = node.parentNode
        if (parent && parent.nodeType === 1) {
            showHidden(parent, array)
        }
    }
}

"Width,Height".replace(rword, function (name) { //fix 481
    var method = name.toLowerCase(),
            clientProp = "client" + name,
            scrollProp = "scroll" + name,
            offsetProp = "offset" + name
    cssHooks[method + ":get"] = function (node, which, override) {
        var boxSizing = -4
        if (typeof override === "number") {
            boxSizing = override
        }
        which = name === "Width" ? ["Left", "Right"] : ["Top", "Bottom"]
        var ret = node[offsetProp] // border-box 0
        if (boxSizing === 2) { // margin-box 2
            return ret + avalon.css(node, "margin" + which[0], true) + avalon.css(node, "margin" + which[1], true)
        }
        if (boxSizing < 0) { // padding-box  -2
            ret = ret - avalon.css(node, "border" + which[0] + "Width", true) - avalon.css(node, "border" + which[1] + "Width", true)
        }
        if (boxSizing === -4) { // content-box -4
            ret = ret - avalon.css(node, "padding" + which[0], true) - avalon.css(node, "padding" + which[1], true)
        }
        return ret
    }
    cssHooks[method + "&get"] = function (node) {
        var hidden = [];
        showHidden(node, hidden);
        var val = cssHooks[method + ":get"](node)
        for (var i = 0, obj; obj = hidden[i++]; ) {
            node = obj.node
            for (var n in obj) {
                if (typeof obj[n] === "string") {
                    node.style[n] = obj[n]
                }
            }
        }
        return val;
    }
    avalon.fn[method] = function (value) { //会忽视其display
        var node = this[0]
        if (arguments.length === 0) {
            if (node.setTimeout) { //取得窗口尺寸,IE9后可以用node.innerWidth /innerHeight代替
                return node["inner" + name]
            }
            if (node.nodeType === 9) { //取得页面尺寸
                var doc = node.documentElement
                //FF chrome    html.scrollHeight< body.scrollHeight
                //IE 标准模式 : html.scrollHeight> body.scrollHeight
                //IE 怪异模式 : html.scrollHeight 最大等于可视窗口多一点？
                return Math.max(node.body[scrollProp], doc[scrollProp], node.body[offsetProp], doc[offsetProp], doc[clientProp])
            }
            return cssHooks[method + "&get"](node)
        } else {
            return this.css(method, value)
        }
    }
    avalon.fn["inner" + name] = function () {
        return cssHooks[method + ":get"](this[0], void 0, -2)
    }
    avalon.fn["outer" + name] = function (includeMargin) {
        return cssHooks[method + ":get"](this[0], void 0, includeMargin === true ? 2 : 0)
    }
})
avalon.fn.offset = function () { //取得距离页面左右角的坐标
    var node = this[0]
    try {
        var rect = node.getBoundingClientRect()
        // Make sure element is not hidden (display: none) or disconnected
        // https://github.com/jquery/jquery/pull/2043/files#r23981494
        if (rect.width || rect.height || node.getClientRects().length) {
            var doc = node.ownerDocument
            var root = doc.documentElement
            var win = doc.defaultView
            return {
                top: rect.top + win.pageYOffset - root.clientTop,
                left: rect.left + win.pageXOffset - root.clientLeft
            }
        }
    } catch (e) {
        return {
            left: 0,
            top: 0
        }
    }
}
//=============================val相关=======================

function getValType(elem) {
    var ret = elem.tagName.toLowerCase()
    return ret === "input" && /checkbox|radio/.test(elem.type) ? "checked" : ret
}
var valHooks = {
    "select:get": function (node, value) {
        var option, options = node.options,
                index = node.selectedIndex,
                one = node.type === "select-one" || index < 0,
                values = one ? null : [],
                max = one ? index + 1 : options.length,
                i = index < 0 ? max : one ? index : 0
        for (; i < max; i++) {
            option = options[i]
            //旧式IE在reset后不会改变selected，需要改用i === index判定
            //我们过滤所有disabled的option元素，但在safari5下，如果设置select为disable，那么其所有孩子都disable
            //因此当一个元素为disable，需要检测其是否显式设置了disable及其父节点的disable情况
            if ((option.selected || i === index) && !option.disabled) {
                value = option.value
                if (one) {
                    return value
                }
                //收集所有selected值组成数组返回
                values.push(value)
            }
        }
        return values
    },
    "select:set": function (node, values, optionSet) {
        values = [].concat(values) //强制转换为数组
        for (var i = 0, el; el = node.options[i++]; ) {
            if ((el.selected = values.indexOf(el.value) > -1)) {
                optionSet = true
            }
        }
        if (!optionSet) {
            node.selectedIndex = -1
        }
    }
}

var keyMap = {}
var keys = ["break,case,catch,continue,debugger,default,delete,do,else,false",
    "finally,for,function,if,in,instanceof,new,null,return,switch,this",
    "throw,true,try,typeof,var,void,while,with", /* 关键字*/
    "abstract,boolean,byte,char,class,const,double,enum,export,extends",
    "final,float,goto,implements,import,int,interface,long,native",
    "package,private,protected,public,short,static,super,synchronized",
    "throws,transient,volatile", /*保留字*/
    "arguments,let,yield,undefined"].join(",")
keys.replace(/\w+/g, function (a) {
    keyMap[a] = true
})
var ridentStart = /[a-z_$]/i
var rwhiteSpace = /[\s\uFEFF\xA0]/
function getIdent(input, lastIndex) {
    var result = []
    var subroutine = !!lastIndex
    lastIndex = lastIndex || 0

    //将表达式中的标识符抽取出来
    var state = "unknown"
    var variable = ""
    for (var i = 0; i < input.length; i++) {
        var c = input.charAt(i)
        if (c === "'" || c === '"') {//字符串开始
            if (state === "unknown") {
                state = c
            } else if (state === c) {//字符串结束
                state = "unknown"
            }
        } else if (c === "\\") {
            if (state === "'" || state === '"') {
                i++
            }
        } else if (ridentStart.test(c)) {//碰到标识符
            if (state === "unknown") {
                state = "variable"
                variable = c
            } else if (state === "maybePath") {
                variable = result.pop()
                variable += "." + c
                state = "variable"
            } else if (state === "variable") {
                variable += c
            }
        } else if (/\w/.test(c)) {
            if (state === "variable") {
                variable += c
            }
        } else if (c === ".") {
            if (state === "variable") {
                if (variable) {
                    result.push(variable)
                    variable = ""
                    state = "maybePath"
                }
            }
        } else if (c === "[") {
            if (state === "variable" || state === "maybePath") {
                if (variable) {//如果前面存在变量,收集它
                    result.push(variable)
                    variable = ""
                }
                var lastLength = result.length
                var last = result[lastLength - 1]
                var innerResult = getIdent(input.slice(i), i)
                if (innerResult.length) {//如果括号中存在变量,那么这里添加通配符
                    result[lastLength - 1] = last + ".*"
                    result = innerResult.concat(result)
                } else { //如果括号中的东西是确定的,直接转换为其子属性
                    var content = input.slice(i + 1, innerResult.i)
                    try {
                        var text = (scpCompile(["return " + content]))()
                        result[lastLength - 1] = last + "." + text
                    } catch (e) {
                    }
                }
                state = "maybePath"//]后面可能还接东西
                i = innerResult.i
            }
        } else if (c === "]") {
            if (subroutine) {
                result.i = i + lastIndex
                addVar(result, variable)
                return result
            }
        } else if (rwhiteSpace.test(c) && c !== "\r" && c !== "\n") {
            if (state === "variable") {
                if (addVar(result, variable)) {
                    state = "maybePath" // aaa . bbb 这样的情况
                }
                variable = ""
            }
        } else {
            addVar(result, variable)
            state = "unknown"
            variable = ""
        }
    }
    addVar(result, variable)
    return result
}
function addVar(array, element) {
    if (element && !keyMap[element]) {
        array.push(element)
        return true
    }
}
function addAssign(vars, vmodel, name, binding) {
    var ret = [],
            prefix = " = " + name + "."
    for (var i = vars.length, prop; prop = vars[--i]; ) {
        var arr = prop.split("."), a
        var first = arr[0]
        while (a = arr.shift()) {
            if (vmodel.hasOwnProperty(a)) {
                ret.push(first + prefix + first)

                binding.observers.push({
                    v: vmodel,
                    p: prop
                })

                vars.splice(i, 1)
            }
        }
    }
    return ret
}
var rproxy = /(\$proxy\$[a-z]+)\d+$/
var variablePool = new Cache(218)
//缓存求值函数，以便多次利用
var evaluatorPool = new Cache(128)

function getVars(expr) {
    expr = expr.trim()
    var ret = variablePool.get(expr)
    if (ret) {
        return ret.concat()
    }
    var array = getIdent(expr)
    var uniq = {}
    var result = []
    for (var i = 0, el; el = array[i++]; ) {
        if (!uniq[el]) {
            uniq[el] = 1
            result.push(el)
        }
    }
    return variablePool.put(expr, result).concat()
}

function parseExpr(expr, vmodels, binding) {
    var filters = binding.filters
    if (typeof filters === "string" && filters.trim() && !binding._filters) {
        binding._filters = parseFilter(filters.trim())
    }

    var vars = getVars(expr)

    var expose = new Date() - 0
    var assigns = []
    var names = []
    var args = []
    binding.observers = []
    for (var i = 0, sn = vmodels.length; i < sn; i++) {
        if (vars.length) {
            var name = "vm" + expose + "_" + i
            names.push(name)
            args.push(vmodels[i])
            assigns.push.apply(assigns, addAssign(vars, vmodels[i], name, binding))
        }
    }
    binding.args = args
    var dataType = binding.type
    var exprId = vmodels.map(function (el) {
        return String(el.$id).replace(rproxy, "$1")
    }) + expr + dataType
    var getter = evaluatorPool.get(exprId) //直接从缓存，免得重复生成
    if (getter) {
        if (dataType === "duplex") {
            var setter = evaluatorPool.get(exprId + "setter")
            binding.setter = setter.apply(setter, binding.args)
        }
        return binding.getter = getter
    }

    if (!assigns.length) {
        assigns.push("fix" + expose)
    }

    if (dataType === "duplex") {
        var nameOne = {}
        assigns.forEach(function (a) {
            var arr = a.split("=")
            nameOne[arr[0].trim()] = arr[1].trim()
        })
        expr = expr.replace(/[\$\w]+/, function (a) {
            return nameOne[a] ? nameOne[a] : a
        })
        /* jshint ignore:start */
        var fn2 = scpCompile(names.concat("'use strict';" +
                "return function(vvv){" + expr + " = vvv\n}\n"))
        /* jshint ignore:end */
        evaluatorPool.put(exprId + "setter", fn2)
        binding.setter = fn2.apply(fn2, binding.args)
    }

    if (dataType === "on") { //事件绑定
        if (expr.indexOf("(") === -1) {
            expr += ".call(this, $event)"
        } else {
            expr = expr.replace("(", ".call(this,")
        }
        names.push("$event")
        expr = "\nreturn " + expr + ";" //IE全家 Function("return ")出错，需要Function("return ;")
        var lastIndex = expr.lastIndexOf("\nreturn")
        var header = expr.slice(0, lastIndex)
        var footer = expr.slice(lastIndex)
        expr = header + "\n" + footer
    } else {
        expr = "\nreturn " + expr + ";" //IE全家 Function("return ")出错，需要Function("return ;")
    }
    /* jshint ignore:start */
    getter = scpCompile(names.concat("'use strict';\nvar " +
            assigns.join(",\n") + expr))
    /* jshint ignore:end */

    return  evaluatorPool.put(exprId, getter)

}
//========

function normalizeExpr(code) {
    var hasExpr = rexpr.test(code) //比如ms-class="width{{w}}"的情况
    if (hasExpr) {
        var array = scanExpr(code)
        if (array.length === 1) {
            return array[0].expr
        }
        return array.map(function (el) {
            return el.type ? "(" + el.expr + ")" : quote(el.expr)
        }).join(" + ")
    } else {
        return code
    }
}

avalon.normalizeExpr = normalizeExpr
avalon.parseExprProxy = parseExpr

var rthimRightParentheses = /\)\s*$/
var rthimOtherParentheses = /\)\s*\|/g
var rquoteFilterName = /\|\s*([$\w]+)/g
var rpatchBracket = /"\s*\["/g
var rthimLeftParentheses = /"\s*\(/g
function parseFilter(filters) {
    filters = filters
            .replace(rthimRightParentheses, "")//处理最后的小括号
            .replace(rthimOtherParentheses, function () {//处理其他小括号
                return "],|"
            })
            .replace(rquoteFilterName, function (a, b) { //处理|及它后面的过滤器的名字
                return "[" + quote(b)
            })
            .replace(rpatchBracket, function () {
                return '"],["'
            })
            .replace(rthimLeftParentheses, function () {
                return '",'
            }) + "]"
    /* jshint ignore:start */
    return  scpCompile(["return [" + filters + "]"])()
    /* jshint ignore:end */

}
/*********************************************************************
 *                          编译系统                                  *
 **********************************************************************/
var quote = JSON.stringify
/*********************************************************************
 *                           扫描系统                                 *
 **********************************************************************/

avalon.scan = function (elem, vmodel) {
    elem = elem || root
    var vmodels = vmodel ? [].concat(vmodel) : []
    scanTag(elem, vmodels)
}

//http://www.w3.org/TR/html5/syntax.html#void-elements
var stopScan = oneObject("area,base,basefont,br,col,command,embed,hr,img,input,link,meta,param,source,track,wbr,noscript,script,style,textarea".toUpperCase())

function checkScan(elem, callback, innerHTML) {
    var id = setTimeout(function () {
        var currHTML = elem.innerHTML
        clearTimeout(id)
        if (currHTML === innerHTML) {
            callback()
        } else {
            checkScan(elem, callback, currHTML)
        }
    })
}


function createSignalTower(elem, vmodel) {
    var id = elem.getAttribute("avalonctrl") || vmodel.$id
    elem.setAttribute("avalonctrl", id)
    if (vmodel.$events) {
        vmodel.$events.expr = elem.tagName + '[avalonctrl="' + id + '"]'
    }
}

var getBindingCallback = function (elem, name, vmodels) {
    var callback = elem.getAttribute(name)
    if (callback) {
        for (var i = 0, vm; vm = vmodels[i++]; ) {
            if (vm.hasOwnProperty(callback) && typeof vm[callback] === "function") {
                return vm[callback]
            }
        }
    }
}

function executeBindings(bindings, vmodels) {
    for (var i = 0, binding; binding = bindings[i++]; ) {
        binding.vmodels = vmodels
        directives[binding.type].init(binding)
      
        avalon.injectBinding(binding)
        if (binding.getter && binding.element.nodeType === 1) { //移除数据绑定，防止被二次解析
            //chrome使用removeAttributeNode移除不存在的特性节点时会报错 https://github.com/RubyLouvre/avalon/issues/99
            binding.element.removeAttribute(binding.name)
        }
    }
    bindings.length = 0
}

//https://github.com/RubyLouvre/avalon/issues/636
var mergeTextNodes = IEVersion && window.MutationObserver ? function (elem) {
    var node = elem.firstChild, text
    while (node) {
        var aaa = node.nextSibling
        if (node.nodeType === 3) {
            if (text) {
                text.nodeValue += node.nodeValue
                elem.removeChild(node)
            } else {
                text = node
            }
        } else {
            text = null
        }
        node = aaa
    }
} : 0
var roneTime = /^\s*::/
var rmsAttr = /ms-(\w+)-?(.*)/

var events = oneObject("animationend,blur,change,input,click,dblclick,focus,keydown,keypress,keyup,mousedown,mouseenter,mouseleave,mousemove,mouseout,mouseover,mouseup,scan,scroll,submit")
var obsoleteAttrs = oneObject("value,title,alt,checked,selected,disabled,readonly,enabled,href,src")
function bindingSorter(a, b) {
    return a.priority - b.priority
}


var rnoCollect = /^(ms-\S+|data-\S+|on[a-z]+|id|style|class)$/
var ronattr = /^on\-[\w-]+$/
function getOptionsFromTag(elem, vmodels) {
    var attributes = elem.attributes
    var ret = {}
    for (var i = 0, attr; attr = attributes[i++]; ) {
        var name = attr.name
        if (attr.specified && !rnoCollect.test(name)) {
            var camelizeName = camelize(attr.name)
            if (/^on\-[\w-]+$/.test(name)) {
                ret[camelizeName] = getBindingCallback(elem, name, vmodels) 
            } else {
                ret[camelizeName] = parseData(attr.value)
            }
        }

    }
    return ret
}
function scanAttr(elem, vmodels, match) {
    var scanNode = true
    if (vmodels.length) {
        var attributes = elem.attributes
        var bindings = []
        var uniq = {}
        for (var i = 0, attr; attr = attributes[i++]; ) {
            var name = attr.name
            if (uniq[name]) {//IE8下ms-repeat,ms-with BUG
                continue
            }
            uniq[name] = 1
            if (attr.specified) {
                if (match = name.match(rmsAttr)) {
                    //如果是以指定前缀命名的
                    var type = match[1]
                    var param = match[2] || ""
                    var value = attr.value
                    if (events[type]) {
                        param = type
                        type = "on"
                    } else if (obsoleteAttrs[type]) {
                        param = type
                        type = "attr"
                        name = "ms-" + type + "-" + param
                        log("warning!请改用" + name + "代替" + attr.name + "!")
                    }
                    if (directives[type]) {
                        var newValue = value.replace(roneTime, "")
                        var oneTime = value !== newValue
                        var binding = {
                            type: type,
                            param: param,
                            element: elem,
                            name: name,
                            expr: newValue,
                            oneTime: oneTime,
                            priority: (directives[type].priority || type.charCodeAt(0) * 10) + (Number(param.replace(/\D/g, "")) || 0)
                        }
                        if (type === "html" || type === "text") {

                            var filters = getToken(value).filters
                            binding.expr = binding.expr.replace(filters, "")
                            binding.filters = filters.replace(rhasHtml, function () {
                                binding.type = "html"
                                binding.group = 1
                                return ""
                            }).trim() // jshint ignore:line
                        } else if (type === "duplex") {
                            var hasDuplex = name
                        } else if (name === "ms-if-loop") {
                            binding.priority += 100
                        } else if (name === "ms-attr-value") {
                            var hasAttrValue = name
                        }
                        bindings.push(binding)
                    }
                }
            }
        }
        if (bindings.length) {
            bindings.sort(bindingSorter)

            if (hasDuplex && hasAttrValue && elem.type === "text") {
                log("warning!一个控件不能同时定义ms-attr-value与" + hasDuplex)
            }

            for (i = 0; binding = bindings[i]; i++) {
                type = binding.type
                if (rnoscanAttrBinding.test(type)) {
                    return executeBindings(bindings.slice(0, i + 1), vmodels)
                } else if (scanNode) {
                    scanNode = !rnoscanNodeBinding.test(type)
                }
            }
            executeBindings(bindings, vmodels)
        }
    }
    if (scanNode && !stopScan[elem.tagName]) {
        mergeTextNodes && mergeTextNodes(elem)
        scanNodeList(elem, vmodels) //扫描子孙元素
    }
}

var rnoscanAttrBinding = /^if|widget|repeat$/
var rnoscanNodeBinding = /^each|with|html|include$/


function scanNodeList(parent, vmodels) {
    var nodes = avalon.slice(parent.childNodes)
    scanNodeArray(nodes, vmodels)
}


function scanNodeArray(nodes, vmodels) {
    for (var i = 0, node; node = nodes[i++]; ) {
        switch (node.nodeType) {
            case 1:
                var elem = node
                if (!elem.msResolved && elem.parentNode && elem.parentNode.nodeType === 1) {
                    var library = isWidget(elem)
                    if (library) {
                        var widget = elem.localName ? elem.localName.replace(library + ":", "") : elem.nodeName
                        var fullName = library + ":" + camelize(widget)
                        componentQueue.push({
                            library: library,
                            element: elem,
                            fullName: fullName,
                            widget: widget,
                            vmodels: vmodels,
                            name: "widget"
                        })
                        if (avalon.components[fullName]) {
                            (function (name) {//确保所有ms-attr-name扫描完再处理
                                setTimeout(function () {
                                    avalon.component(name)
                                })
                            })(fullName)
                        }
                    }
                }

                scanTag(node, vmodels) //扫描元素节点

                if (node.msHasEvent) {
                    avalon.fireDom(node, "datasetchanged", {
                        bubble: node.msHasEvent
                    })
                }

                break
            case 3:
                if (rexpr.test(node.nodeValue)) {
                    scanText(node, vmodels, i) //扫描文本节点
                }
                break
        }

    }
}


function scanTag(elem, vmodels, node) {
    //扫描顺序  ms-skip(0) --> ms-important(1) --> ms-controller(2) --> ms-if(10) --> ms-repeat(100) 
    //--> ms-if-loop(110) --> ms-attr(970) ...--> ms-each(1400)-->ms-with(1500)--〉ms-duplex(2000)垫后        
    var a = elem.getAttribute("ms-skip")
    var b = elem.getAttributeNode("ms-important")
    var c = elem.getAttributeNode("ms-controller")
    if (typeof a === "string") {
        return
    } else if (node = b || c) {
        var newVmodel = avalon.vmodels[node.value]
        if (!newVmodel) {
            return
        }
        //ms-important不包含父VM，ms-controller相反
        vmodels = node === b ? [newVmodel] : [newVmodel].concat(vmodels)
        elem.removeAttribute(node.name) //removeAttributeNode不会刷新[ms-controller]样式规则
        elem.classList.remove(node.name)
        createSignalTower(elem, newVmodel)
    }
    scanAttr(elem, vmodels) //扫描特性节点
}
var rhasHtml = /\|\s*html(?:\b|$)/,
    r11a = /\|\|/g,
    rlt = /&lt;/g,
    rgt = /&gt;/g,
    rstringLiteral = /(['"])(\\\1|.)+?\1/g

function getToken(value) {
    if (value.indexOf("|") > 0) {
        var scapegoat = value.replace(rstringLiteral, function (_) {
            return Array(_.length + 1).join("1") // jshint ignore:line
        })
        var index = scapegoat.replace(r11a, "\u1122\u3344").indexOf("|") //干掉所有短路或
        if (index > -1) {
            return {
                type: "text",
                filters: value.slice(index).trim(),
                expr: value.slice(0, index)
            }
        }
    }
    return {
        type: "text",
        expr: value,
        filters: ""
    }
}

function scanExpr(str) {
    var tokens = [],
        value, start = 0,
        stop
    do {
        stop = str.indexOf(openTag, start)
        if (stop === -1) {
            break
        }
        value = str.slice(start, stop)
        if (value) { // {{ 左边的文本
            tokens.push({
                expr: value
            })
        }
        start = stop + openTag.length
        stop = str.indexOf(closeTag, start)
        if (stop === -1) {
            break
        }
        value = str.slice(start, stop)
        if (value) { //处理{{ }}插值表达式
            tokens.push(getToken(value, start))
        }
        start = stop + closeTag.length
    } while (1)
    value = str.slice(start)
    if (value) { //}} 右边的文本
        tokens.push({
            expr: value
        })
    }
    return tokens
}

function scanText(textNode, vmodels, index) {
    var bindings = [],
    tokens = scanExpr(textNode.data)
    if (tokens.length) {
        for (var i = 0, token; token = tokens[i++];) {
            var node = DOC.createTextNode(token.expr) //将文本转换为文本节点，并替换原来的文本节点
            if (token.type) {
                token.expr = token.expr.replace(roneTime, function () {
                        token.oneTime = true
                        return ""
                    }) // jshint ignore:line
                token.element = node
                token.filters = token.filters.replace(rhasHtml, function () {
                        token.type = "html"
                        return ""
                    }) // jshint ignore:line
                token.pos = index * 1000 + i
                bindings.push(token) //收集带有插值表达式的文本
            }
            avalonFragment.appendChild(node)
        }
        textNode.parentNode.replaceChild(avalonFragment, textNode)
        if (bindings.length)
            executeBindings(bindings, vmodels)
    }
}



//使用来自游戏界的双缓冲技术,减少对视图的冗余刷新
var Buffer = function () {
    this.queue = []
}
Buffer.prototype = {
    render: function (isAnimate) {
        if (!this.locked) {
            this.locked = isAnimate ? root.offsetHeight + 10 : 1
            var me = this
            avalon.nextTick(function () {
                me.flush()
            })
        }
    },
    flush: function () {
        for (var i = 0, sub; sub = this.queue[i++]; ) {
            sub.update && sub.update()
        }
        this.locked = 0
        this.queue = []
    }
}

var buffer = new Buffer()
var componentQueue = []
var widgetList = []
var componentHooks = {
    $construct: function () {
        return avalon.mix.apply(null, arguments)
    },
    $ready: noop,
    $init: noop,
    $dispose: noop,
    $container: null,
    $childReady: noop,
    $replace: false,
    $extend: null,
    $$template: function (str) {
        return str
    }
}


avalon.components = {}
avalon.component = function (name, opts) {
    if (opts) {
        avalon.components[name] = avalon.mix({}, componentHooks, opts)
    }
    for (var i = 0, obj; obj = componentQueue[i]; i++) {
        if (name === obj.fullName) {
            componentQueue.splice(i, 1)
            i--;

            (function (host, hooks, elem, widget) {
                //如果elem已从Document里移除,直接返回
                //issuse : https://github.com/RubyLouvre/avalon2/issues/40
                if (!avalon.contains(DOC, elem)) {
                    avalon.Array.remove(componentQueue, host)
                    return
                }
                
                var dependencies = 1
                var library = host.library
                var global = avalon.libraries[library] || componentHooks

                //===========收集各种配置=======
                if (elem.getAttribute("ms-attr-identifier")) {
                    //如果还没有解析完,就延迟一下 #1155
                    return
                }
                var elemOpts = getOptionsFromTag(elem, host.vmodels)
                var vmOpts = getOptionsFromVM(host.vmodels, elemOpts.config || host.widget)
                var $id = elemOpts.$id || elemOpts.identifier || generateID(widget)
                delete elemOpts.config
                delete elemOpts.$id
                delete elemOpts.identifier
                var componentDefinition = {}

                var parentHooks = avalon.components[hooks.$extend]
                if (parentHooks) {
                    avalon.mix(true, componentDefinition, parentHooks)
                    componentDefinition = parentHooks.$construct.call(elem, componentDefinition, {}, {})
                } else {
                    avalon.mix(true, componentDefinition, hooks)
                }
                componentDefinition = avalon.components[name].$construct.call(elem, componentDefinition, vmOpts, elemOpts)

                componentDefinition.$refs = {}
                componentDefinition.$id = $id

                //==========构建VM=========
                var keepSlot = componentDefinition.$slot
                var keepReplace = componentDefinition.$replace
                var keepContainer = componentDefinition.$container
                var keepTemplate = componentDefinition.$template
                delete componentDefinition.$slot
                delete componentDefinition.$replace
                delete componentDefinition.$container
                delete componentDefinition.$construct

                var vmodel = avalon.define(componentDefinition) || {}
                elem.msResolved = 1
                vmodel.$init(vmodel, elem)
                global.$init(vmodel, elem)
                var nodes = elem.childNodes
                //收集插入点
                var slots = {}, snode
                for (var s = 0, el; el = nodes[s++]; ) {
                    var type = el.nodeType === 1 && el.getAttribute("slot") || keepSlot
                    if (type) {
                        if (slots[type]) {
                            slots[type].push(el)
                        } else {
                            slots[type] = [el]
                        }
                    }
                }


                if (vmodel.$$template) {
                    avalon.clearHTML(elem)
                    elem.innerHTML = vmodel.$$template(keepTemplate)
                }
                for (s in slots) {
                    if (vmodel.hasOwnProperty(s)) {
                        var ss = slots[s]
                        if (ss.length) {
                            var fragment = avalonFragment.cloneNode(true)
                            for (var ns = 0; snode = ss[ns++]; ) {
                                fragment.appendChild(snode)
                            }
                            vmodel[s] = fragment
                        }
                        slots[s] = null
                    }
                }
                slots = null
                var child = elem.children[0] || elem.firstChild
                if (keepReplace) {
                    elem.parentNode.replaceChild(child, elem)
                    child.msResolved = 1
                    var cssText = elem.style.cssText
                    var className = elem.className
                    elem = host.element = child
                    elem.style.cssText = cssText
                    if (className) {
                        avalon(elem).addClass(className)
                    }
                }
                if (keepContainer) {
                    keepContainer.appendChild(elem)
                }
                avalon.fireDom(elem, "datasetchanged",
                        {library: library, vm: vmodel, childReady: 1})
                var children = 0
                var removeFn = avalon.bind(elem, "datasetchanged", function (e) {
                    if (e.childReady && e.library === library) {
                        dependencies += e.childReady
                        if (vmodel !== e.vm) {
                            vmodel.$refs[e.vm.$id] = e.vm
                            if (e.childReady === -1) {
                                children++
                                vmodel.$childReady(vmodel, elem, e)
                            }
                            e.stopPropagation()
                        }
                    }
                    if (dependencies === 0) {
                        var id1 = setTimeout(function () {
                            clearTimeout(id1)

                            vmodel.$ready(vmodel, elem, host.vmodels)
                            global.$ready(vmodel, elem, host.vmodels)
                        }, children ? Math.max(children * 17, 100) : 17)
                        avalon.unbind(elem, "datasetchanged", removeFn)
                        //==================
                        host.rollback = function () {
                            try {
                                vmodel.$dispose(vmodel, elem)
                                global.$dispose(vmodel, elem)
                            } catch (e) {
                            }
                            delete avalon.vmodels[vmodel.$id]
                        }
                        injectDisposeQueue(host, widgetList)
                        if (window.chrome) {
                            elem.addEventListener("DOMNodeRemovedFromDocument", function () {
                                setTimeout(rejectDisposeQueue)
                            })
                        }

                    }
                })
                scanTag(elem, [vmodel].concat(host.vmodels))

                avalon.vmodels[vmodel.$id] = vmodel
                if (!elem.childNodes.length) {
                    avalon.fireDom(elem, "datasetchanged", {library: library, vm: vmodel, childReady: -1})
                } else {
                    var id2 = setTimeout(function () {
                        clearTimeout(id2)
                        avalon.fireDom(elem, "datasetchanged", {library: library, vm: vmodel, childReady: -1})
                    }, 17)
                }


            })(obj, avalon.components[name], obj.element, obj.widget)// jshint ignore:line


        }
    }
}


function getOptionsFromVM(vmodels, pre) {
    if (pre) {
        for (var i = 0, v; v = vmodels[i++]; ) {
            if (v.hasOwnProperty(pre) && typeof v[pre] === "object") {
                var vmOptions = v[pre]
                return vmOptions.$model || vmOptions
                break
            }
        }
    }
    return {}
}



avalon.libraries = []
avalon.library = function (name, opts) {
    if (DOC.namespaces) {
        DOC.namespaces.add(name, 'http://www.w3.org/1999/xhtml');
    }
    avalon.libraries[name] = avalon.mix({
        $init: noop,
        $ready: noop,
        $dispose: noop
    }, opts || {})
}

avalon.library("ms")
/*
 broswer  nodeName  scopeName  localName
 IE9     ONI:BUTTON oni        button
 IE10    ONI:BUTTON undefined  oni:button
 IE8     button     oni        undefined
 chrome  ONI:BUTTON undefined  oni:button
 
 */
function isWidget(el) { //如果为自定义标签,返回UI库的名字
    if (el.scopeName && el.scopeName !== "HTML") {
        return el.scopeName
    }
    var fullName = el.nodeName.toLowerCase()
    var index = fullName.indexOf(":")
    if (index > 0) {
        return fullName.slice(0, index)
    }
}
//各种MVVM框架在大型表格下的性能测试
// https://github.com/RubyLouvre/avalon/issues/859


var bools = ["autofocus,autoplay,async,allowTransparency,checked,controls",
    "declare,disabled,defer,defaultChecked,defaultSelected",
    "contentEditable,isMap,loop,multiple,noHref,noResize,noShade",
    "open,readOnly,selected"
].join(",")
var boolMap = {}
bools.replace(rword, function (name) {
    boolMap[name.toLowerCase()] = name
})

var propMap = {//属性名映射
    "accept-charset": "acceptCharset",
    "char": "ch",
    "charoff": "chOff",
    "class": "className",
    "for": "htmlFor",
    "http-equiv": "httpEquiv"
}

var anomaly = ["accessKey,bgColor,cellPadding,cellSpacing,codeBase,codeType,colSpan",
    "dateTime,defaultValue,frameBorder,longDesc,maxLength,marginWidth,marginHeight",
    "rowSpan,tabIndex,useMap,vSpace,valueType,vAlign"
].join(",")
anomaly.replace(rword, function (name) {
    propMap[name.toLowerCase()] = name
})


var attrDir = avalon.directive("attr", {
    init: function (binding) {
        //{{aaa}} --> aaa
        //{{aaa}}/bbb.html --> (aaa) + "/bbb.html"
        binding.expr = normalizeExpr(binding.expr.trim())
        if (binding.type === "include") {
            var elem = binding.element
            effectBinding(elem, binding)
            binding.includeRendered = getBindingCallback(elem, "data-include-rendered", binding.vmodels)
            binding.includeLoaded = getBindingCallback(elem, "data-include-loaded", binding.vmodels)
            var outer = binding.includeReplace = !!avalon(elem).data("includeReplace")
            if (avalon(elem).data("includeCache")) {
                binding.templateCache = {}
            }
            binding.start = DOC.createComment("ms-include")
            binding.end = DOC.createComment("ms-include-end")
            if (outer) {
                binding.element = binding.end
                binding._element = elem
                elem.parentNode.insertBefore(binding.start, elem)
                elem.parentNode.insertBefore(binding.end, elem.nextSibling)
            } else {
                elem.insertBefore(binding.start, elem.firstChild)
                elem.appendChild(binding.end)
            }
        }
    },
    update: function (val) {
        var elem = this.element
        var attrName = this.param
        if (attrName === "href" || attrName === "src") {
            if (typeof val === "string" && !root.hasAttribute) {
                val = val.replace(/&amp;/g, "&") //处理IE67自动转义的问题
            }
            elem[attrName] = val
            if (window.chrome && elem.tagName === "EMBED") {
                var parent = elem.parentNode //#525  chrome1-37下embed标签动态设置src不能发生请求
                var comment = document.createComment("ms-src")
                parent.replaceChild(comment, elem)
                parent.replaceChild(elem, comment)
            }
        } else {

            // ms-attr-class="xxx" vm.xxx="aaa bbb ccc"将元素的className设置为aaa bbb ccc
            // ms-attr-class="xxx" vm.xxx=false  清空元素的所有类名
            // ms-attr-name="yyy"  vm.yyy="ooo" 为元素设置name属性
            var toRemove = (val === false) || (val === null) || (val === void 0)
            if (!W3C && propMap[attrName]) { //旧式IE下需要进行名字映射
                attrName = propMap[attrName]
            }
            var bool = boolMap[attrName]
            if (typeof elem[bool] === "boolean") {
                elem[bool] = !!val //布尔属性必须使用el.xxx = true|false方式设值
                if (!val) { //如果为false, IE全系列下相当于setAttribute(xxx,''),会影响到样式,需要进一步处理
                    toRemove = true
                }
            }
            if (toRemove) {
                return elem.removeAttribute(attrName)
            }
            //SVG只能使用setAttribute(xxx, yyy), VML只能使用elem.xxx = yyy ,HTML的固有属性必须elem.xxx = yyy
            var isInnate = rsvg.test(elem) ? false : (DOC.namespaces && isVML(elem)) ? true : attrName in elem.cloneNode(false)
            if (isInnate) {
                elem[attrName] = val + ""
            } else {
                elem.setAttribute(attrName, val)
            }
        }
    }
})



//这几个指令都可以使用插值表达式，如ms-src="aaa/{{b}}/{{c}}.html"
"title,alt,src,value,css,include,href".replace(rword, function (name) {
    directives[name] = attrDir
})

//根据VM的属性值或表达式的值切换类名，ms-class="xxx yyy zzz:flag"
//http://www.cnblogs.com/rubylouvre/archive/2012/12/17/2818540.html
avalon.directive("class", {
    init: function (binding) {
        var oldStyle = binding.param
        var method = binding.type
        if (!oldStyle || isFinite(oldStyle)) {
            binding.param = "" //去掉数字
            directives.effect.init(binding)
        } else {
            log('ms-' + method + '-xxx="yyy"这种用法已经过时,请使用ms-' + method + '="xxx:yyy"')
            binding.expr = '[' + quote(oldStyle) + "," + binding.expr + "]"
            binding.oldStyle = oldStyle
        }
        if (method === "hover" || method === "active") { //确保只绑定一次
            if (!binding.hasBindEvent) {
                var elem = binding.element
                var $elem = avalon(elem)
                var activate = "mouseenter" //在移出移入时切换类名
                var abandon = "mouseleave"
                if (method === "active") { //在聚焦失焦中切换类名
                    elem.tabIndex = elem.tabIndex || -1
                    activate = "mousedown"
                    abandon = "mouseup"
                    var fn0 = $elem.bind("mouseleave", function () {
                        binding.toggleClass && $elem.removeClass(binding.newClass)
                    })
                }
            }

            var fn1 = $elem.bind(activate, function () {
                binding.toggleClass && $elem.addClass(binding.newClass)
            })
            var fn2 = $elem.bind(abandon, function () {
                binding.toggleClass && $elem.removeClass(binding.newClass)
            })
            binding.rollback = function () {
                $elem.unbind("mouseleave", fn0)
                $elem.unbind(activate, fn1)
                $elem.unbind(abandon, fn2)
            }
            binding.hasBindEvent = true
        }

    },
    update: function (arr) {
        var binding = this
        var $elem = avalon(this.element)
        binding.newClass = arr[0]
        binding.toggleClass = !!arr[1]
        if (binding.oldClass && binding.newClass !== binding.oldClass) {
            $elem.removeClass(binding.oldClass)
        }
        binding.oldClass = binding.newClass
        if (binding.type === "class") {
            if (binding.oldStyle) {
                $elem.toggleClass(binding.oldStyle, !!arr[1])
            } else {
                $elem.toggleClass(binding.newClass, binding.toggleClass)
            }
        }
    }
})

"hover,active".replace(rword, function (name) {
    directives[name] = directives["class"]
})


//ms-controller绑定已经在scanTag 方法中实现
avalon.directive("css", {
    init: directives.attr.init,
    update: function (val) {
        avalon(this.element).css(this.param, val)
    }
})

avalon.directive("data", {
    priority: 100,
    update: function (val) {
        var elem = this.element
        var key = "data-" + this.param
        if (val && typeof val === "object") {
            elem[key] = val
        } else {
            elem.setAttribute(key, String(val))
        }
    }
})

//双工绑定
var rduplexType = /^(?:checkbox|radio)$/
var rduplexParam = /^(?:radio|checked)$/
var rnoduplexInput = /^(file|button|reset|submit|checkbox|radio|range)$/
var duplexBinding = avalon.directive("duplex", {
    priority: 2000,
    init: function (binding, hasCast) {
        var elem = binding.element
        var vmodels = binding.vmodels
        binding.changed = getBindingCallback(elem, "data-duplex-changed", vmodels) || noop
        var params = []
        var casting = oneObject("string,number,boolean,checked")
        if (elem.type === "radio" && binding.param === "") {
            binding.param = "checked"
        }

        binding.param.replace(rw20g, function (name) {
            if (rduplexType.test(elem.type) && rduplexParam.test(name)) {
                if (name === "radio")
                    log("ms-duplex-radio已经更名为ms-duplex-checked")
                name = "checked"
                binding.isChecked = true
                binding.xtype = "radio"
            }
            if (name === "bool") {
                name = "boolean"
                log("ms-duplex-bool已经更名为ms-duplex-boolean")
            } else if (name === "text") {
                name = "string"
                log("ms-duplex-text已经更名为ms-duplex-string")
            }
            if (casting[name]) {
                hasCast = true
            }
            avalon.Array.ensure(params, name)
        })
        if (!hasCast) {
            params.push("string")
        }
        binding.param = params.join("-")
        if (!binding.xtype) {
            binding.xtype = elem.tagName === "SELECT" ? "select" :
                    elem.type === "checkbox" ? "checkbox" :
                    elem.type === "radio" ? "radio" :
                    /^change/.test(elem.getAttribute("data-duplex-event")) ? "change" :
                    "input"
        }
        //===================绑定事件======================
        binding.bound = function (type, callback) {
            elem.addEventListener(type, callback, false)
            var old = binding.rollback
            binding.rollback = function () {
                elem.avalonSetter = null
                avalon.unbind(elem, type, callback)
                old && old()
            }
        }
        var composing = false
        function callback(value) {
            binding.changed.call(this, value, binding)
        }
        function compositionStart() {
            composing = true
        }
        function compositionEnd() {
            composing = false
        }
        var updateVModel = function (e) {
            var val = elem.value //防止递归调用形成死循环
            if (composing || val === binding.oldValue || binding.pipe === null) //处理中文输入法在minlengh下引发的BUG
                return
            var lastValue = binding.pipe(val, binding, "get")
            binding.setter(lastValue)
            callback.call(elem, lastValue)
        }
        switch (binding.xtype) {
            case "radio":
                binding.bound("click", function () {
                    var lastValue = binding.pipe(elem.value, binding, "get")
                    binding.setter(lastValue)
                    callback.call(elem, lastValue)
                })
                break
            case "checkbox":
                binding.bound("change", function () {
                    var method = elem.checked ? "ensure" : "remove"
                    var array = binding.getter.apply(0, binding.vmodels)
                    if (!Array.isArray(array)) {
                        log("ms-duplex应用于checkbox上要对应一个数组")
                        array = [array]
                    }
                    var val = binding.pipe(elem.value, binding, "get")
                    avalon.Array[method](array, val)
                    callback.call(elem, array)
                })
                break
            case "change":
                binding.bound("change", updateVModel)
                break
            case "input":
                if (!IEVersion) { // W3C
                    binding.bound("input", updateVModel)
                    //非IE浏览器才用这个
                    binding.bound("compositionstart", compositionStart)
                    binding.bound("compositionend", compositionEnd)
                    binding.bound("DOMAutoComplete", updateVModel)
                } else { //onpropertychange事件无法区分是程序触发还是用户触发
                    // IE下通过selectionchange事件监听IE9+点击input右边的X的清空行为，及粘贴，剪切，删除行为
                    binding.bound("input", updateVModel) //IE9使用propertychange无法监听中文输入改动
                    //http://www.cnblogs.com/rubylouvre/archive/2013/02/17/2914604.html
                    //http://www.matts411.com/post/internet-explorer-9-oninput/
                }

                break
            case "select":
                binding.bound("change", function () {
                    var val = avalon(elem).val() //字符串或字符串数组
                    if (Array.isArray(val)) {
                        val = val.map(function (v) {
                            return binding.pipe(v, binding, "get")
                        })
                    } else {
                        val = binding.pipe(val, binding, "get")
                    }
                    if (val + "" !== binding.oldValue) {
                        try {
                            binding.setter(val)
                        } catch (ex) {
                            log(ex)
                        }
                    }
                })
                binding.bound("datasetchanged", function (e) {
                    if (e.bubble === "selectDuplex") {
                        var value = binding._value
                        var curValue = Array.isArray(value) ? value.map(String) : value + ""
                        avalon(elem).val(curValue)
                        elem.oldValue = curValue + ""
                        callback.call(elem, curValue)
                    }
                })
                break
        }
        if (binding.xtype === "input" && !rnoduplexInput.test(elem.type)) {
            if (elem.type !== "hidden") {
                var beforeFocus
                binding.bound("focus", function () {
                    elem.msFocus = true
                    beforeFocus = elem.value
                })
                binding.bound("blur", function () {
                    elem.msFocus = false
                    //IE6-11如果元素绑定了oninput onpropertychange事件会影响onchange事件触发
                    if(IEVersion && beforeFocus !== elem.value ){
                        elem.value = beforeFocus
                        avalon.fireDom(elem, "change")
                    }
                })
            }
            elem.avalonSetter = updateVModel //#765
            watchValueInTimer(function () {
                if (root.contains(elem)) {
                    if (!elem.msFocus && binding.oldValue !== elem.value) {
                        updateVModel()
                    }
                } else if (!elem.msRetain) {
                    return false
                }
            })
        }

    },
    update: function (value) {
        var elem = this.element, binding = this, curValue
        if (!this.init) {
            for (var i in avalon.vmodels) {
                var v = avalon.vmodels[i]
                v.$fire("avalon-ms-duplex-init", binding)
            }
            var cpipe = binding.pipe || (binding.pipe = pipe)
            cpipe(null, binding, "init")
            this.init = 1
        }
        switch (this.xtype) {
            case "input":
            case "change":
                curValue = this.pipe(value, this, "set")  //fix #673
                if (curValue !== this.oldValue) {
                    var fixCaret = false
                    if (elem.msFocus) {
                        try {
                            var start = elem.selectionStart
                            var end = elem.selectionEnd
                            if (start === end) {
                                var pos = start
                                fixCaret = true
                            }
                        } catch (e) {
                        }
                    }
                    elem.value = this.oldValue = curValue
                    if (fixCaret) {
                        elem.selectionStart = elem.selectionEnd = pos
                    }
                }
                break
            case "radio":
                curValue = binding.isChecked ? !!value : value + "" === elem.value
                elem.checked = curValue
                break
            case "checkbox":
                var array = [].concat(value) //强制转换为数组
                curValue = this.pipe(elem.value, this, "get")
                elem.checked = array.indexOf(curValue) > -1
                break
            case "select":
                //必须变成字符串后才能比较
                binding._value = value
                if (!elem.msHasEvent) {
                    elem.msHasEvent = "selectDuplex"
                    //必须等到其孩子准备好才触发
                } else {
                    avalon.fireDom(elem, "datasetchanged", {
                        bubble: elem.msHasEvent
                    })
                }
                break
        }
    }
})


function fixNull(val) {
    return val == null ? "" : val
}
avalon.duplexHooks = {
    checked: {
        get: function (val, binding) {
            return !binding.oldValue
        }
    },
    string: {
        get: function (val) { //同步到VM
            return val
        },
        set: fixNull
    },
    "boolean": {
        get: function (val) {
            return val === "true"
        },
        set: fixNull
    },
    number: {
        get: function (val, binding) {
            var number = parseFloat(val)
            if (-val === -number) {
                return number
            }
            var arr = /strong|medium|weak/.exec(binding.element.getAttribute("data-duplex-number")) || ["medium"]
            switch (arr[0]) {
                case "strong":
                    return 0
                case "medium":
                    return val === "" ? "" : 0
                case "weak":
                    return val
            }
        },
        set: fixNull
    }
}

function pipe(val, binding, action, e) {
    binding.param.replace(rw20g, function (name) {
        var hook = avalon.duplexHooks[name]
        if (hook && typeof hook[action] === "function") {
            val = hook[action](val, binding)
        }
    })
    return val
}

var TimerID, ribbon = []

avalon.tick = function (fn) {
    if (ribbon.push(fn) === 1) {
        TimerID = setInterval(ticker, 60)
    }
}

function ticker() {
    for (var n = ribbon.length - 1; n >= 0; n--) {
        var el = ribbon[n]
        if (el() === false) {
            ribbon.splice(n, 1)
        }
    }
    if (!ribbon.length) {
        clearInterval(TimerID)
    }
}

var watchValueInTimer = noop
new function () { // jshint ignore:line
    try { //#272 IE9-IE11, firefox
        var setters = {}
        var aproto = HTMLInputElement.prototype
        var bproto = HTMLTextAreaElement.prototype
        function newSetter(value) { // jshint ignore:line
            setters[this.tagName].call(this, value)
            if (!this.msFocus && this.avalonSetter) {
                this.avalonSetter()
            }
        }
        var inputProto = HTMLInputElement.prototype
        Object.getOwnPropertyNames(inputProto) //故意引发IE6-8等浏览器报错
        setters["INPUT"] = Object.getOwnPropertyDescriptor(aproto, "value").set

        Object.defineProperty(aproto, "value", {
            set: newSetter
        })
        setters["TEXTAREA"] = Object.getOwnPropertyDescriptor(bproto, "value").set
        Object.defineProperty(bproto, "value", {
            set: newSetter
        })
    } catch (e) {
        //在chrome 43中 ms-duplex终于不需要使用定时器实现双向绑定了
        // http://updates.html5rocks.com/2015/04/DOM-attributes-now-on-the-prototype
        // https://docs.google.com/document/d/1jwA8mtClwxI-QJuHT7872Z0pxpZz8PBkf2bGAbsUtqs/edit?pli=1
        watchValueInTimer = avalon.tick
    }
} // jshint ignore:line

avalon.directive("effect", {
    priority: 5,
    init: function (binding) {
        var text = binding.expr,
                className,
                rightExpr
        var colonIndex = text.replace(rexprg, function (a) {
            return a.replace(/./g, "0")
        }).indexOf(":") //取得第一个冒号的位置
        if (colonIndex === -1) { // 比如 ms-class/effect="aaa bbb ccc" 的情况
            className = text
            rightExpr = true
        } else { // 比如 ms-class/effect-1="ui-state-active:checked" 的情况
            className = text.slice(0, colonIndex)
            rightExpr = text.slice(colonIndex + 1)
        }
        if (!rexpr.test(text)) {
            className = quote(className)
        } else {
            className = normalizeExpr(className)
        }
        binding.expr = "[" + className + "," + rightExpr + "]"
    },
    update: function (arr) {
        var name = arr[0]
        var elem = this.element
        if (elem.getAttribute("data-effect-name") === name) {
            return
        } else {
            elem.removeAttribute("data-effect-driver")
        }
        var inlineStyles = elem.style
        var computedStyles = window.getComputedStyle ? window.getComputedStyle(elem) : null
        var useAni = false
        if (computedStyles && (supportTransition || supportAnimation)) {

            //如果支持CSS动画
            var duration = inlineStyles[transitionDuration] || computedStyles[transitionDuration]
            if (duration && duration !== '0s') {
                elem.setAttribute("data-effect-driver", "t")
                useAni = true
            }

            if (!useAni) {

                duration = inlineStyles[animationDuration] || computedStyles[animationDuration]
                if (duration && duration !== '0s') {
                    elem.setAttribute("data-effect-driver", "a")
                    useAni = true
                }

            }
        }

        if (!useAni) {
            if (avalon.effects[name]) {
                elem.setAttribute("data-effect-driver", "j")
                useAni = true
            }
        }
        if (useAni) {
            elem.setAttribute("data-effect-name", name)
        }
    }
})

avalon.effects = {}
avalon.effect = function (name, callbacks) {
    avalon.effects[name] = callbacks
}



var supportTransition = false
var supportAnimation = false

var transitionEndEvent
var animationEndEvent
var transitionDuration = avalon.cssName("transition-duration")
var animationDuration = avalon.cssName("animation-duration")
new function () {// jshint ignore:line
    var checker = {
        'TransitionEvent': 'transitionend',
        'WebKitTransitionEvent': 'webkitTransitionEnd',
        'OTransitionEvent': 'oTransitionEnd',
        'otransitionEvent': 'otransitionEnd'
    }
    var tran
    //有的浏览器同时支持私有实现与标准写法，比如webkit支持前两种，Opera支持1、3、4
    for (var name in checker) {
        if (window[name]) {
            tran = checker[name]
            break;
        }
        try {
            var a = document.createEvent(name);
            tran = checker[name]
            break;
        } catch (e) {
        }
    }
    if (typeof tran === "string") {
        supportTransition = true
        transitionEndEvent = tran
    }

    //大致上有两种选择
    //IE10+, Firefox 16+ & Opera 12.1+: animationend
    //Chrome/Safari: webkitAnimationEnd
    //http://blogs.msdn.com/b/davrous/archive/2011/12/06/introduction-to-css3-animat ions.aspx
    //IE10也可以使用MSAnimationEnd监听，但是回调里的事件 type依然为animationend
    //  el.addEventListener("MSAnimationEnd", function(e) {
    //     alert(e.type)// animationend！！！
    // })
    checker = {
        'AnimationEvent': 'animationend',
        'WebKitAnimationEvent': 'webkitAnimationEnd'
    }
    var ani;
    for (name in checker) {
        if (window[name]) {
            ani = checker[name];
            break;
        }
    }
    if (typeof ani === "string") {
        supportTransition = true
        animationEndEvent = ani
    }

}()

var effectPool = []//重复利用动画实例
function effectFactory(el, opts) {
    if (!el || el.nodeType !== 1) {
        return null
    }
    if (opts) {
        var name = opts.effectName
        var driver = opts.effectDriver
    } else {
        name = el.getAttribute("data-effect-name")
        driver = el.getAttribute("data-effect-driver")
    }
    if (!name || !driver) {
        return null
    }

    var instance = effectPool.pop() || new Effect()
    instance.el = el
    instance.driver = driver
    instance.useCss = driver !== "j"
    if (instance.useCss) {
        opts && avalon(el).addClass(opts.effectClass)
        instance.cssEvent = driver === "t" ? transitionEndEvent : animationEndEvent
    }
    instance.name = name
    instance.callbacks = avalon.effects[name] || {}

    return instance


}

function effectBinding(elem, binding) {
    var name = elem.getAttribute("data-effect-name")
    if (name) {
        binding.effectName = name
        binding.effectDriver = elem.getAttribute("data-effect-driver")
        var stagger = +elem.getAttribute("data-effect-stagger")
        binding.effectLeaveStagger = +elem.getAttribute("data-effect-leave-stagger") || stagger
        binding.effectEnterStagger = +elem.getAttribute("data-effect-enter-stagger") || stagger
        binding.effectClass = elem.className || NaN
    }
}
function upperFirstChar(str) {
    return str.replace(/^[\S]/g, function (m) {
        return m.toUpperCase()
    })
}
var effectBuffer = new Buffer()
function Effect() {
}// 动画实例,做成类的形式,是为了共用所有原型方法

Effect.prototype = {
    contrustor: Effect,
    enterClass: function () {
        return getEffectClass(this, "enter")
    },
    leaveClass: function () {
        return getEffectClass(this, "leave")
    },
    // 共享一个函数
    actionFun: function (name, before, after) {
        if (document.hidden) {
            return
        }
        var me = this
        var el = me.el
        var isLeave = name === "leave"
        name = isLeave ? "leave" : "enter"
        var oppositeName = isLeave ? "enter" : "leave"
        callEffectHook(me, "abort" + upperFirstChar(oppositeName))
        callEffectHook(me, "before" + upperFirstChar(name))
        if (!isLeave)
            before(el) //  这里可能做插入DOM树的操作,因此必须在修改类名前执行
        var cssCallback = function (cancel) {
            el.removeEventListener(me.cssEvent, me.cssCallback)
            if (isLeave) {
                before(el) //这里可能做移出DOM树操作,因此必须位于动画之后
                avalon(el).removeClass(me.cssClass)
            } else {
                if (me.driver === "a") {
                    avalon(el).removeClass(me.cssClass)
                }
            }
            if (cancel !== true) {
                callEffectHook(me, "after" + upperFirstChar(name))
                after && after(el)
            }
            me.dispose()
        }
        if (me.useCss) {
            if (me.cssCallback) { //如果leave动画还没有完成,立即完成
                me.cssCallback(true)
            }

            me.cssClass = getEffectClass(me, name)
            me.cssCallback = cssCallback

            me.update = function () {
                el.addEventListener(me.cssEvent, me.cssCallback)
                if (!isLeave && me.driver === "t") {//transtion延迟触发
                    avalon(el).removeClass(me.cssClass)
                }
            }
            avalon(el).addClass(me.cssClass)//animation会立即触发

            effectBuffer.render(true)
            effectBuffer.queue.push(me)

        } else {
            callEffectHook(me, name, cssCallback)

        }
    },
    enter: function (before, after) {
        this.actionFun.apply(this, ["enter"].concat(avalon.slice(arguments)))

    },
    leave: function (before, after) {
        this.actionFun.apply(this, ["leave"].concat(avalon.slice(arguments)))

    },
    dispose: function () {//销毁与回收到池子中
        this.update = this.cssCallback = null
        if (effectPool.unshift(this) > 100) {
            effectPool.pop()
        }
    }


}


function getEffectClass(instance, type) {
    var a = instance.callbacks[type + "Class"]
    if (typeof a === "string")
        return a
    if (typeof a === "function")
        return a()
    return instance.name + "-" + type
}


function callEffectHook(effect, name, cb) {
    var hook = effect.callbacks[name]
    if (hook) {
        hook.call(effect, effect.el, cb)
    }
}

var applyEffect = function (el, dir/*[before, [after, [opts]]]*/) {
    var args = aslice.call(arguments, 0)
    if (typeof args[2] !== "function") {
        args.splice(2, 0, noop)
    }
    if (typeof args[3] !== "function") {
        args.splice(3, 0, noop)
    }
    var before = args[2]
    var after = args[3]
    var opts = args[4]
    var effect = effectFactory(el, opts)
    if (!effect) {
        before()
        after()
        return false
    } else {
        var method = dir ? 'enter' : 'leave'
        effect[method](before, after)
    }
}

avalon.mix(avalon.effect, {
    apply: applyEffect,
    append: function (el, parent, after, opts) {
        return applyEffect(el, 1, function () {
            parent.appendChild(el)
        }, after, opts)
    },
    before: function (el, target, after, opts) {
        return applyEffect(el, 1, function () {
            target.parentNode.insertBefore(el, target)
        }, after, opts)
    },
    remove: function (el, parent, after, opts) {
        return applyEffect(el, 0, function () {
            if (el.parentNode === parent)
                parent.removeChild(el)
        }, after, opts)
    }
})


avalon.directive("html", {
    update: function (val) {
        var binding = this
        var elem = this.element
        var isHtmlFilter = elem.nodeType !== 1
        var parent = isHtmlFilter ? elem.parentNode : elem
        if (!parent)
            return
        val = val == null ? "" : val

        if (elem.nodeType === 3) {
            var signature = generateID("html")
            parent.insertBefore(DOC.createComment(signature), elem)
            binding.element = DOC.createComment(signature + ":end")
            parent.replaceChild(binding.element, elem)
            elem = binding.element
        }
        if (typeof val !== "object") {//string, number, boolean
            var fragment = avalon.parseHTML(String(val))
        } else if (val.nodeType === 11) { //将val转换为文档碎片
            fragment = val
        } else if (val.nodeType === 1 || val.item) {
            var nodes = val.nodeType === 1 ? val.childNodes : val.item
            fragment = avalonFragment.cloneNode(true)
            while (nodes[0]) {
                fragment.appendChild(nodes[0])
            }
        }

        nodes = avalon.slice(fragment.childNodes)
        //插入占位符, 如果是过滤器,需要有节制地移除指定的数量,如果是html指令,直接清空
        if (isHtmlFilter) {
            var endValue = elem.nodeValue.slice(0, -4)
            while (true) {
                var node = elem.previousSibling
                if (!node || node.nodeType === 8 && node.nodeValue === endValue) {
                    break
                } else {
                    parent.removeChild(node)
                }
            }
            parent.insertBefore(fragment, elem)
        } else {
            avalon.clearHTML(elem).appendChild(fragment)
        }
        scanNodeArray(nodes, binding.vmodels)
    }
})

avalon.directive("if", {
    priority: 10,
    update: function (val) {
        var binding = this
        var elem = this.element
        var stamp = binding.stamp = +new Date()
        var par
        var after = function () {
            if (stamp !== binding.stamp)
                return
            binding.recoverNode = null
        }
        if (binding.recoverNode)
            binding.recoverNode() // 还原现场，有移动节点的都需要还原现场
        try {
            if (!elem.parentNode)
                return
            par = elem.parentNode
        } catch (e) {
            return
        }
        if (val) { //插回DOM树
            function alway() {// jshint ignore:line
                if (elem.getAttribute(binding.name)) {
                    elem.removeAttribute(binding.name)
                    scanAttr(elem, binding.vmodels)
                }
                binding.rollback = null
            }
            if (elem.nodeType === 8) {
                var keep = binding.keep
                var hasEffect = avalon.effect.apply(keep, 1, function () {
                    if (stamp !== binding.stamp)
                        return
                    elem.parentNode.replaceChild(keep, elem)
                    elem = binding.element = keep //这时可能为null
                    if (keep.getAttribute("_required")) {//#1044
                        elem.required = true
                        elem.removeAttribute("_required")
                    }
                    if (elem.querySelectorAll) {
                        avalon.each(elem.querySelectorAll("[_required=true]"), function (el) {
                            el.required = true
                            el.removeAttribute("_required")
                        })
                    }
                    alway()
                }, after)
                hasEffect = hasEffect === false
            }
            if (!hasEffect)
                alway()
        } else { //移出DOM树，并用注释节点占据原位置
            if (elem.nodeType === 1) {
                if (elem.required === true) {
                    elem.required = false
                    elem.setAttribute("_required", "true")
                }
                try {// 如果不支持querySelectorAll或:required,可以直接无视
                    avalon.each(elem.querySelectorAll(":required"), function (el) {
                        elem.required = false
                        el.setAttribute("_required", "true")
                    })
                } catch (e) {
                }

                var node = binding.element = DOC.createComment("ms-if"),
                        pos = elem.nextSibling
                binding.recoverNode = function () {
                    binding.recoverNode = null
                    if (node.parentNode !== par) {
                        par.insertBefore(node, pos)
                        binding.keep = elem
                    }
                }

                avalon.effect.apply(elem, 0, function () {
                    binding.recoverNode = null
                    if (stamp !== binding.stamp)
                        return
                    elem.parentNode.replaceChild(node, elem)
                    binding.keep = elem //元素节点
                    ifGroup.appendChild(elem)
                    binding.rollback = function () {
                        if (elem.parentNode === ifGroup) {
                            ifGroup.removeChild(elem)
                        }
                    }
                }, after)
            }
        }
    }
})



//ms-important绑定已经在scanTag 方法中实现
var rnoscripts = /<noscript.*?>(?:[\s\S]+?)<\/noscript>/img
var rnoscriptText = /<noscript.*?>([\s\S]+?)<\/noscript>/im

var getXHR = function () {
    return new window.XMLHttpRequest() // jshint ignore:line
}
//将所有远程加载的模板,以字符串形式存放到这里
var templatePool = avalon.templateCache = {}

function getTemplateContainer(binding, id, text) {
    var div = binding.templateCache && binding.templateCache[id]
    if (div) {
        var dom = DOC.createDocumentFragment(),
                firstChild
        while (firstChild = div.firstChild) {
            dom.appendChild(firstChild)
        }
        return dom
    }
    return avalon.parseHTML(text)

}
function nodesToFrag(nodes) {
    var frag = DOC.createDocumentFragment()
    for (var i = 0, len = nodes.length; i < len; i++) {
        frag.appendChild(nodes[i])
    }
    return frag
}
avalon.directive("include", {
    init: directives.attr.init,
    update: function (val) {
        var binding = this
        var elem = this.element
        var vmodels = binding.vmodels
        var rendered = binding.includeRendered
        var effectClass = binding.effectName && binding.effectClass // 是否开启动画
        var templateCache = binding.templateCache // 是否data-include-cache
        var outer = binding.includeReplace // 是否data-include-replace
        var loaded = binding.includeLoaded
        var target = outer ? elem.parentNode : elem
        var _ele = binding._element // data-include-replace binding.element === binding.end

        binding.recoverNodes = binding.recoverNodes || avalon.noop

        var scanTemplate = function (text) {
            var _stamp = binding._stamp = +(new Date()) // 过滤掉频繁操作
            if (loaded) {
                var newText = loaded.apply(target, [text].concat(vmodels))
                if (typeof newText === "string")
                    text = newText
            }
            if (rendered) {
                checkScan(target, function () {
                    rendered.call(target)
                }, NaN)
            }
            var lastID = binding.includeLastID || "_default" // 默认

            binding.includeLastID = val
            var leaveEl = templateCache && templateCache[lastID] || DOC.createElement(elem.tagName || binding._element.tagName) // 创建一个离场元素

            if (effectClass) {
                leaveEl.className = effectClass
                target.insertBefore(leaveEl, binding.start) // 插入到start之前，防止被错误的移动
            }

            // cache or animate，移动节点
            (templateCache || {})[lastID] = leaveEl
            var fragOnDom = binding.recoverNodes() // 恢复动画中的节点
            if (fragOnDom) {
                target.insertBefore(fragOnDom, binding.end)
            }
            while (true) {
                var node = binding.start.nextSibling
                if (node && node !== leaveEl && node !== binding.end) {
                    leaveEl.appendChild(node)
                } else {
                    break
                }
            }

            // 元素退场
            avalon.effect.remove(leaveEl, target, function () {
                if (templateCache) { // write cache
                    if (_stamp === binding._stamp)
                        ifGroup.appendChild(leaveEl)
                }
            }, binding)


            var enterEl = target,
                    before = avalon.noop,
                    after = avalon.noop

            var fragment = getTemplateContainer(binding, val, text)
            var nodes = avalon.slice(fragment.childNodes)

            if (outer && effectClass) {
                enterEl = _ele
                enterEl.innerHTML = "" // 清空
                enterEl.setAttribute("ms-skip", "true")
                target.insertBefore(enterEl, binding.end.nextSibling) // 插入到bingding.end之后避免被错误的移动
                before = function () {
                    enterEl.insertBefore(fragment, null) // 插入节点
                }
                after = function () {
                    binding.recoverNodes = avalon.noop
                    if (_stamp === binding._stamp) {
                        fragment = nodesToFrag(nodes)
                        target.insertBefore(fragment, binding.end) // 插入真实element
                        scanNodeArray(nodes, vmodels)
                    }
                    if (enterEl.parentNode === target)
                        target.removeChild(enterEl) // 移除入场动画元素
                }
                binding.recoverNodes = function () {
                    binding.recoverNodes = avalon.noop
                    return nodesToFrag(nodes)
                }
            } else {
                before = function () {// 新添加元素的动画 
                    target.insertBefore(fragment, binding.end)
                    scanNodeArray(nodes, vmodels)
                }
            }

            avalon.effect.apply(enterEl, "enter", before, after)

        }


        if (binding.param === "src") {
            if (typeof templatePool[val] === "string") {
                avalon.nextTick(function () {
                    scanTemplate(templatePool[val])
                })
            } else if (Array.isArray(templatePool[val])) { //#805 防止在循环绑定中发出许多相同的请求
                templatePool[val].push(scanTemplate)
            } else {
                var xhr = getXHR()
                xhr.onload = function () {
                    var text = xhr.responseText
                    for (var f = 0, fn; fn = templatePool[val][f++]; ) {
                        fn(text)
                    }
                    templatePool[val] = text
                }
                xhr.onerror = function () {
                    log("ms-include load [" + val + "] error")
                }
                templatePool[val] = [scanTemplate]
                xhr.open("GET", val, true)
                if ("withCredentials" in xhr) {
                    xhr.withCredentials = true
                }
                xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
                xhr.send(null)
            }
        } else {
            //IE系列与够新的标准浏览器支持通过ID取得元素（firefox14+）
            //http://tjvantoll.com/2012/07/19/dom-element-references-as-global-variables/
            var el = val && val.nodeType === 1 ? val : DOC.getElementById(val)
            if (el) {
                avalon.nextTick(function () {
                    scanTemplate(el.value || el.innerText || el.innerHTML)
                })
            }
        }
    }
})

var rdash = /\(([^)]*)\)/
var onDir = avalon.directive("on", {
    priority: 3000,
    init: function (binding) {
        var value = binding.expr
        binding.type = "on"
        var eventType = binding.param.replace(/-\d+$/, "") // ms-on-mousemove-10
        if (typeof onDir[eventType + "Hook"] === "function") {
            onDir[eventType + "Hook"](binding)
        }
        if (value.indexOf("(") > 0 && value.indexOf(")") > -1) {
            var matched = (value.match(rdash) || ["", ""])[1].trim()
            if (matched === "" || matched === "$event") { // aaa() aaa($event)当成aaa处理
                value = value.replace(rdash, "")
            }
        }
        binding.expr = value
    },
    update: function (callback) {
        var binding = this
        var elem = this.element
        callback = function (e) {
            var fn = binding.getter || noop
            return fn.apply(this, binding.args.concat(e))
        }
        
        var eventType = binding.param.replace(/-\d+$/, "") // ms-on-mousemove-10
        if (eventType === "scan") {
            callback.call(elem, {
                type: eventType
            })
        } else if (typeof binding.specialBind === "function") {
            binding.specialBind(elem, callback)
        } else {
            var removeFn = avalon.bind(elem, eventType, callback)
        }
        binding.rollback = function () {
            if (typeof binding.specialUnbind === "function") {
                binding.specialUnbind()
            } else {
                avalon.unbind(elem, eventType, removeFn)
            }
        }
    }
})
avalon.directive("repeat", {
    priority: 90,
    init: function (binding) {
        var type = binding.type
        binding.cache = {} //用于存放代理VM
        binding.enterCount = 0

        var elem = binding.element
        if (elem.nodeType === 1) {
            elem.removeAttribute(binding.name)
            effectBinding(elem, binding)
            binding.param = binding.param || "el"
            binding.sortedCallback = getBindingCallback(elem, "data-with-sorted", binding.vmodels)
            var rendered = getBindingCallback(elem, "data-" + type + "-rendered", binding.vmodels)

            var signature = generateID(type)
            var start = DOC.createComment(signature + ":start")
            var end = binding.element = DOC.createComment(signature + ":end")
            binding.signature = signature
            binding.start = start
            binding.template = avalonFragment.cloneNode(false)
            if (type === "repeat") {
                var parent = elem.parentNode
                parent.replaceChild(end, elem)
                parent.insertBefore(start, end)
                binding.template.appendChild(elem)
            } else {
                while (elem.firstChild) {
                    binding.template.appendChild(elem.firstChild)
                }
                elem.appendChild(start)
                elem.appendChild(end)
                parent = elem
            }
            binding.element = end

            if (rendered) {
                var removeFn = avalon.bind(parent, "datasetchanged", function () {
                    rendered.apply(parent, parent.args)
                    avalon.unbind(parent, "datasetchanged", removeFn)
                    parent.msRendered = rendered
                })
            }
        }
    },
    update: function (value, oldValue) {
        var binding = this
        var xtype = this.xtype

        this.enterCount += 1
        var init = !oldValue
        if (init) {
            binding.$outer = {}
            var check0 = "$key"
            var check1 = "$val"
            if (xtype === "array") {
                check0 = "$first"
                check1 = "$last"
            }
            for (var i = 0, v; v = binding.vmodels[i++]; ) {
                if (v.hasOwnProperty(check0) && v.hasOwnProperty(check1)) {
                    binding.$outer = v
                    break
                }
            }
        }
        var track = this.track
        if (binding.sortedCallback) { //如果有回调，则让它们排序
            var keys2 = binding.sortedCallback.call(parent, track)
            if (keys2 && Array.isArray(keys2)) {
                track = keys2
            }
        }

        var action = "move"
        binding.$repeat = value
        var fragments = []
        var transation = init && avalonFragment.cloneNode(false)
        var proxies = []
        var param = this.param
        var retain = avalon.mix({}, this.cache)
        var elem = this.element
        var length = track.length

        var parent = elem.parentNode
        for (i = 0; i < length; i++) {

            var keyOrId = track[i] //array为随机数, object 为keyName
            var proxy = retain[keyOrId]
            if (!proxy) {
                
                proxy = getProxyVM(this)
                proxy.$up = null
                if (xtype === "array") {
                    action = "add"
                    proxy.$id = keyOrId
                    var valueItem = value[i]
                    proxy[param] = valueItem //index
                    if(Object(valueItem) === valueItem){
                        valueItem.$ups = valueItem.$ups || {}
                        valueItem.$ups[param] = proxy
                    }

                } else {
                    action = "append"
                    proxy.$key = keyOrId
                    proxy.$val = value[keyOrId] //key
                }
                this.cache[keyOrId] = proxy
                var node = proxy.$anchor || (proxy.$anchor = elem.cloneNode(false))
                node.nodeValue = this.signature
                shimController(binding, transation, proxy, fragments, init && !binding.effectDriver)
                decorateProxy(proxy, binding, xtype)
            } else {
//                if (xtype === "array") {
//                    proxy[param] = value[i]
//                }
                fragments.push({})
                retain[keyOrId] = true
            }

            //重写proxy
            if (this.enterCount === 1) {// 防止多次进入,导致位置不对
                proxy.$active = false
                proxy.$oldIndex = proxy.$index
                proxy.$active = true
                proxy.$index = i

            }

            if (xtype === "array") {
                proxy.$first = i === 0
                proxy.$last = i === length - 1
                // proxy[param] = value[i]
            } else {
                proxy.$val = toJson(value[keyOrId]) // 这里是处理vm.object = newObject的情况 
            }
            proxies.push(proxy)
        }
        this.proxies = proxies
        if (init && !binding.effectDriver) {
            parent.insertBefore(transation, elem)
            fragments.forEach(function (fragment) {
                scanNodeArray(fragment.nodes || [], fragment.vmodels)
                //if(fragment.vmodels.length > 2)
                fragment.nodes = fragment.vmodels = null
            })// jshint ignore:line
        } else {

            var staggerIndex = binding.staggerIndex = 0
            for (keyOrId in retain) {
                if (retain[keyOrId] !== true) {

                    action = "del"
                    removeItem(retain[keyOrId].$anchor, binding)
                    // avalon.log("删除", keyOrId)
                    // 相当于delete binding.cache[key]
                    proxyRecycler(this.cache, keyOrId, param)
                    retain[keyOrId] = null
                }
            }

            //  console.log(effectEnterStagger)
            for (i = 0; i < length; i++) {
                proxy = proxies[i]
                keyOrId = xtype === "array" ? proxy.$id : proxy.$key
                var pre = proxies[i - 1]
                var preEl = pre ? pre.$anchor : binding.start
                if (!retain[keyOrId]) {//如果还没有插入到DOM树
                    (function (fragment, preElement) {
                        var nodes = fragment.nodes
                        var vmodels = fragment.vmodels
                        if (nodes) {
                            staggerIndex = mayStaggerAnimate(binding.effectEnterStagger, function () {
                                parent.insertBefore(fragment.content, preElement.nextSibling)
                                scanNodeArray(nodes, vmodels)
                                animateRepeat(nodes, 1, binding)
                            }, staggerIndex)
                        }
                        fragment.nodes = fragment.vmodels = null
                    })(fragments[i], preEl)// jshint ignore:line
                    // avalon.log("插入")

                } else if (proxy.$index !== proxy.$oldIndex) {
                    (function (proxy2, preElement) {
                        staggerIndex = mayStaggerAnimate(binding.effectEnterStagger, function () {
                            var curNode = removeItem(proxy2.$anchor)// 如果位置被挪动了
                            var inserted = avalon.slice(curNode.childNodes)
                            parent.insertBefore(curNode, preElement.nextSibling)
                            animateRepeat(inserted, 1, binding)
                        }, staggerIndex)
                    })(proxy, preEl)// jshint ignore:line

                    // avalon.log("移动", proxy.$oldIndex, "-->", proxy.$index)
                }
            }

        }
        if (!value.$track) {//如果是非监控对象,那么就将其$events清空,阻止其持续监听
            for (keyOrId in this.cache) {
                proxyRecycler(this.cache, keyOrId, param)
            }

        }

        //repeat --> duplex
        (function (args) {
            parent.args = args
            if (parent.msRendered) {//第一次事件触发,以后直接调用
                parent.msRendered.apply(parent, args)
            }
        })(kernel.newWatch ? arguments : [action]);
        var id = setTimeout(function () {
            clearTimeout(id)
            //触发上层的select回调及自己的rendered回调
            avalon.fireDom(parent, "datasetchanged", {
                bubble: parent.msHasEvent
            })
        })
        this.enterCount -= 1

    }

})

"with,each".replace(rword, function (name) {
    directives[name] = avalon.mix({}, directives.repeat, {
        priority: 1400
    })
})


function animateRepeat(nodes, isEnter, binding) {
    for (var i = 0, node; node = nodes[i++]; ) {
        if (node.className === binding.effectClass) {
            avalon.effect.apply(node, isEnter, noop, noop, binding)
        }
    }
}

function mayStaggerAnimate(staggerTime, callback, index) {
    if (staggerTime) {
        setTimeout(callback, (++index) * staggerTime)
    } else {
        callback()
    }
    return index
}


function removeItem(node, binding) {
    var fragment = avalonFragment.cloneNode(false)
    var last = node
    var breakText = last.nodeValue
    var staggerIndex = binding && Math.max(+binding.staggerIndex, 0)
    var nodes = avalon.slice(last.parentNode.childNodes)
    var index = nodes.indexOf(last)
    while (true) {
        var pre = nodes[--index] //node.previousSibling
        if (!pre || String(pre.nodeValue).indexOf(breakText) === 0) {
            break
        }

        if (binding && (pre.className === binding.effectClass)) {
            node = pre;
            (function (cur) {
                binding.staggerIndex = mayStaggerAnimate(binding.effectLeaveStagger, function () {
                    avalon.effect.apply(cur, 0, noop, function () {
                        fragment.appendChild(cur)
                    }, binding)
                }, staggerIndex)
            })(pre);// jshint ignore:line
        } else {
            fragment.insertBefore(pre, fragment.firstChild)
        }
    }
    fragment.appendChild(last)
    return fragment
}


function shimController(data, transation, proxy, fragments, init) {
    var content = data.template.cloneNode(true)
    var nodes = avalon.slice(content.childNodes)
    content.appendChild(proxy.$anchor)
    init && transation.appendChild(content)
    var nv = [proxy].concat(data.vmodels)
    var fragment = {
        nodes: nodes,
        vmodels: nv,
        content: content
    }
    fragments.push(fragment)
}
// {}  -->  {xx: 0, yy: 1, zz: 2} add
// {xx: 0, yy: 1, zz: 2}  -->  {xx: 0, yy: 1, zz: 2, uu: 3}
// [xx: 0, yy: 1, zz: 2}  -->  {xx: 0, zz: 1, yy: 2}

function getProxyVM(binding) {
    var agent = binding.xtype === "object" ? withProxyAgent : eachProxyAgent
    var proxy = agent(binding)
    var node = proxy.$anchor || (proxy.$anchor = binding.element.cloneNode(false))
    node.nodeValue = binding.signature
    proxy.$outer = binding.$outer
    return proxy
}

var eachProxyPool = []

function eachProxyAgent(data, proxy) {
    var itemName = data.param || "el"
    for (var i = 0, n = eachProxyPool.length; i < n; i++) {
        var candidate = eachProxyPool[i]
        if (candidate && candidate.hasOwnProperty(itemName)) {
            eachProxyPool.splice(i, 1)
            proxy = candidate
            break
        }
    }
    if (!proxy) {
        proxy = eachProxyFactory(itemName)
    }
    return proxy
}

function eachProxyFactory(itemName) {
    var source = {
        $outer: {},
        $index: 0,
        $oldIndex: 0,
        $anchor: null,
        //-----
        $first: false,
        $last: false,
        $remove: avalon.noop
    }
    source[itemName] = NaN

    var force = {
        $last: 1,
        $first: 1,
        $index: 1
    }
    force[itemName] = 1
    var proxy = modelFactory(source, {
        force: force
    })
    proxy.$id = generateID("$proxy$each")
    return proxy
}

function decorateProxy(proxy, binding, type) {
    if (type === "array") {
        proxy.$remove = function () {

            binding.$repeat.removeAt(proxy.$index)
        }
        var param = binding.param


        proxy.$watch(param, function (a) {
            var index = proxy.$index
            binding.$repeat[index] = a
        })
    } else {
        proxy.$watch("$val", function fn(a) {
            binding.$repeat[proxy.$key] = a
        })
    }
}

var withProxyPool = []

function withProxyAgent() {
    return withProxyPool.pop() || withProxyFactory()
}

function withProxyFactory() {
    var proxy = modelFactory({
        $key: "",
        $val: NaN,
        $index: 0,
        $oldIndex: 0,
        $outer: {},
        $anchor: null
    }, {
        force: {
            $key: 1,
            $val: 1,
            $index: 1
        }
    })
    proxy.$id = generateID("$proxy$with")
    return proxy
}


function proxyRecycler(cache, key, param) {
    var proxy = cache[key]
    if (proxy) {
        var proxyPool = proxy.$id.indexOf("$proxy$each") === 0 ? eachProxyPool : withProxyPool
        proxy.$outer = {}

        for (var i in proxy.$events) {
            var a = proxy.$events[i]
            if (Array.isArray(a)) {
                a.length = 0
                if (i === param) {
                    proxy[param] = NaN

                } else if (i === "$val") {
                    proxy.$val = NaN
                }
            }
        }

        if (proxyPool.unshift(proxy) > kernel.maxRepeatSize) {
            proxyPool.pop()
        }
        delete cache[key]
    }
}
/*********************************************************************
 *                         各种指令                                  *
 **********************************************************************/
//ms-skip绑定已经在scanTag 方法中实现
avalon.directive("text", {
    update: function (val) {
        var elem = this.element
        val = val == null ? "" : val //不在页面上显示undefined null
        if (elem.nodeType === 3) { //绑定在文本节点上
            try { //IE对游离于DOM树外的节点赋值会报错
                elem.data = val
            } catch (e) {
            }
        } else { //绑定在特性节点上
            elem.textContent = val
        }
    }
})
function parseDisplay(nodeName, val) {
    //用于取得此类标签的默认display值
    var key = "_" + nodeName
    if (!parseDisplay[key]) {
        var node = DOC.createElement(nodeName)
        root.appendChild(node)
        if (W3C) {
            val = getComputedStyle(node, null).display
        } else {
            val = node.currentStyle.display
        }
        root.removeChild(node)
        parseDisplay[key] = val
    }
    return parseDisplay[key]
}

avalon.parseDisplay = parseDisplay

avalon.directive("visible", {
    init: function (binding) {
        effectBinding(binding.element, binding)
    },
    update: function (val) {
        var binding = this, elem = this.element, stamp
        var noEffect = !this.effectName
        if (!this.stamp) {
            stamp = this.stamp = +new Date
            if (val) {
                elem.style.display = binding.display || ""
                if (avalon(elem).css("display") === "none") {
                    elem.style.display = binding.display = parseDisplay(elem.nodeName)
                }
            } else {
                elem.style.display = "none"
            }
            return
        }
        stamp = this.stamp = +new Date
        if (val) {
            avalon.effect.apply(elem, 1, function () {
                if (stamp !== binding.stamp)
                    return
                var driver = elem.getAttribute("data-effect-driver") || "a"

                if (noEffect) {//不用动画时走这里
                    elem.style.display = binding.display || ""
                }
                // "a", "t"
                if (driver === "a" || driver === "t") {
                    if (avalon(elem).css("display") === "none") {
                        elem.style.display = binding.display || parseDisplay(elem.nodeName)
                    }
                }
            })
        } else {
            avalon.effect.apply(elem, 0, function () {
                if (stamp !== binding.stamp)
                    return
                elem.style.display = "none"
            })
        }
    }
})

/*********************************************************************
 *                             自带过滤器                            *
 **********************************************************************/
var rscripts = /<script[^>]*>([\S\s]*?)<\/script\s*>/gim
var ron = /\s+(on[^=\s]+)(?:=("[^"]*"|'[^']*'|[^\s>]+))?/g
var ropen = /<\w+\b(?:(["'])[^"]*?(\1)|[^>])*>/ig
var rsanitize = {
    a: /\b(href)\=("javascript[^"]*"|'javascript[^']*')/ig,
    img: /\b(src)\=("javascript[^"]*"|'javascript[^']*')/ig,
    form: /\b(action)\=("javascript[^"]*"|'javascript[^']*')/ig
}
var rsurrogate = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g
var rnoalphanumeric = /([^\#-~| |!])/g;

function numberFormat(number, decimals, point, thousands) {
    //form http://phpjs.org/functions/number_format/
    //number	必需，要格式化的数字
    //decimals	可选，规定多少个小数位。
    //point	可选，规定用作小数点的字符串（默认为 . ）。
    //thousands	可选，规定用作千位分隔符的字符串（默认为 , ），如果设置了该参数，那么所有其他参数都是必需的。
    number = (number + '')
            .replace(/[^0-9+\-Ee.]/g, '')
    var n = !isFinite(+number) ? 0 : +number,
            prec = !isFinite(+decimals) ? 3 : Math.abs(decimals),
            sep = thousands || ",",
            dec = point || ".",
            s = '',
            toFixedFix = function(n, prec) {
                var k = Math.pow(10, prec)
                return '' + (Math.round(n * k) / k)
                        .toFixed(prec)
            }
    // Fix for IE parseFloat(0.55).toFixed(0) = 0;
    s = (prec ? toFixedFix(n, prec) : '' + Math.round(n))
            .split('.')
    if (s[0].length > 3) {
        s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep)
    }
    if ((s[1] || '')
            .length < prec) {
        s[1] = s[1] || ''
        s[1] += new Array(prec - s[1].length + 1)
                .join('0')
    }
    return s.join(dec)
}


var filters = avalon.filters = {
    uppercase: function(str) {
        return str.toUpperCase()
    },
    lowercase: function(str) {
        return str.toLowerCase()
    },
    truncate: function(str, length, truncation) {
        //length，新字符串长度，truncation，新字符串的结尾的字段,返回新字符串
        length = length || 30
        truncation = typeof truncation === "string" ?  truncation : "..." 
        return str.length > length ? str.slice(0, length - truncation.length) + truncation : String(str)
    },
    $filter: function(val) {
        for (var i = 1, n = arguments.length; i < n; i++) {
            var array = arguments[i]
            var fn = avalon.filters[array[0]]
            if (typeof fn === "function") {
                var arr = [val].concat(array.slice(1))
                val = fn.apply(null, arr)
            }
        }
        return val
    },
    camelize: camelize,
    //https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet
    //    <a href="javasc&NewLine;ript&colon;alert('XSS')">chrome</a> 
    //    <a href="data:text/html;base64, PGltZyBzcmM9eCBvbmVycm9yPWFsZXJ0KDEpPg==">chrome</a>
    //    <a href="jav	ascript:alert('XSS');">IE67chrome</a>
    //    <a href="jav&#x09;ascript:alert('XSS');">IE67chrome</a>
    //    <a href="jav&#x0A;ascript:alert('XSS');">IE67chrome</a>
    sanitize: function(str) {
        return str.replace(rscripts, "").replace(ropen, function(a, b) {
            var match = a.toLowerCase().match(/<(\w+)\s/)
            if (match) { //处理a标签的href属性，img标签的src属性，form标签的action属性
                var reg = rsanitize[match[1]]
                if (reg) {
                    a = a.replace(reg, function(s, name, value) {
                        var quote = value.charAt(0)
                        return name + "=" + quote + "javascript:void(0)" + quote// jshint ignore:line
                    })
                }
            }
            return a.replace(ron, " ").replace(/\s+/g, " ") //移除onXXX事件
        })
    },
    escape: function(str) {
        //将字符串经过 str 转义得到适合在页面中显示的内容, 例如替换 < 为 &lt 
        return String(str).
                replace(/&/g, '&amp;').
                replace(rsurrogate, function(value) {
                    var hi = value.charCodeAt(0)
                    var low = value.charCodeAt(1)
                    return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';'
                }).
                replace(rnoalphanumeric, function(value) {
                    return '&#' + value.charCodeAt(0) + ';'
                }).
                replace(/</g, '&lt;').
                replace(/>/g, '&gt;')
    },
    currency: function(amount, symbol, fractionSize) {
        return (symbol || "\uFFE5") + numberFormat(amount, isFinite(fractionSize) ? fractionSize : 2)
    },
    number: numberFormat
}
/*
 'yyyy': 4 digit representation of year (e.g. AD 1 => 0001, AD 2010 => 2010)
 'yy': 2 digit representation of year, padded (00-99). (e.g. AD 2001 => 01, AD 2010 => 10)
 'y': 1 digit representation of year, e.g. (AD 1 => 1, AD 199 => 199)
 'MMMM': Month in year (January-December)
 'MMM': Month in year (Jan-Dec)
 'MM': Month in year, padded (01-12)
 'M': Month in year (1-12)
 'dd': Day in month, padded (01-31)
 'd': Day in month (1-31)
 'EEEE': Day in Week,(Sunday-Saturday)
 'EEE': Day in Week, (Sun-Sat)
 'HH': Hour in day, padded (00-23)
 'H': Hour in day (0-23)
 'hh': Hour in am/pm, padded (01-12)
 'h': Hour in am/pm, (1-12)
 'mm': Minute in hour, padded (00-59)
 'm': Minute in hour (0-59)
 'ss': Second in minute, padded (00-59)
 's': Second in minute (0-59)
 'a': am/pm marker
 'Z': 4 digit (+sign) representation of the timezone offset (-1200-+1200)
 format string can also be one of the following predefined localizable formats:
 
 'medium': equivalent to 'MMM d, y h:mm:ss a' for en_US locale (e.g. Sep 3, 2010 12:05:08 pm)
 'short': equivalent to 'M/d/yy h:mm a' for en_US locale (e.g. 9/3/10 12:05 pm)
 'fullDate': equivalent to 'EEEE, MMMM d,y' for en_US locale (e.g. Friday, September 3, 2010)
 'longDate': equivalent to 'MMMM d, y' for en_US locale (e.g. September 3, 2010
 'mediumDate': equivalent to 'MMM d, y' for en_US locale (e.g. Sep 3, 2010)
 'shortDate': equivalent to 'M/d/yy' for en_US locale (e.g. 9/3/10)
 'mediumTime': equivalent to 'h:mm:ss a' for en_US locale (e.g. 12:05:08 pm)
 'shortTime': equivalent to 'h:mm a' for en_US locale (e.g. 12:05 pm)
 */
new function() {// jshint ignore:line
    function toInt(str) {
        return parseInt(str, 10) || 0
    }

    function padNumber(num, digits, trim) {
        var neg = ""
        if (num < 0) {
            neg = '-'
            num = -num
        }
        num = "" + num
        while (num.length < digits)
            num = "0" + num
        if (trim)
            num = num.substr(num.length - digits)
        return neg + num
    }

    function dateGetter(name, size, offset, trim) {
        return function(date) {
            var value = date["get" + name]()
            if (offset > 0 || value > -offset)
                value += offset
            if (value === 0 && offset === -12) {
                value = 12
            }
            return padNumber(value, size, trim)
        }
    }

    function dateStrGetter(name, shortForm) {
        return function(date, formats) {
            var value = date["get" + name]()
            var get = (shortForm ? ("SHORT" + name) : name).toUpperCase()
            return formats[get][value]
        }
    }

    function timeZoneGetter(date) {
        var zone = -1 * date.getTimezoneOffset()
        var paddedZone = (zone >= 0) ? "+" : ""
        paddedZone += padNumber(Math[zone > 0 ? "floor" : "ceil"](zone / 60), 2) + padNumber(Math.abs(zone % 60), 2)
        return paddedZone
    }
    //取得上午下午

    function ampmGetter(date, formats) {
        return date.getHours() < 12 ? formats.AMPMS[0] : formats.AMPMS[1]
    }
    var DATE_FORMATS = {
        yyyy: dateGetter("FullYear", 4),
        yy: dateGetter("FullYear", 2, 0, true),
        y: dateGetter("FullYear", 1),
        MMMM: dateStrGetter("Month"),
        MMM: dateStrGetter("Month", true),
        MM: dateGetter("Month", 2, 1),
        M: dateGetter("Month", 1, 1),
        dd: dateGetter("Date", 2),
        d: dateGetter("Date", 1),
        HH: dateGetter("Hours", 2),
        H: dateGetter("Hours", 1),
        hh: dateGetter("Hours", 2, -12),
        h: dateGetter("Hours", 1, -12),
        mm: dateGetter("Minutes", 2),
        m: dateGetter("Minutes", 1),
        ss: dateGetter("Seconds", 2),
        s: dateGetter("Seconds", 1),
        sss: dateGetter("Milliseconds", 3),
        EEEE: dateStrGetter("Day"),
        EEE: dateStrGetter("Day", true),
        a: ampmGetter,
        Z: timeZoneGetter
    }
    var rdateFormat = /((?:[^yMdHhmsaZE']+)|(?:'(?:[^']|'')*')|(?:E+|y+|M+|d+|H+|h+|m+|s+|a|Z))(.*)/
    var raspnetjson = /^\/Date\((\d+)\)\/$/
    filters.date = function(date, format) {
        var locate = filters.date.locate,
                text = "",
                parts = [],
                fn, match
        format = format || "mediumDate"
        format = locate[format] || format
        if (typeof date === "string") {
            if (/^\d+$/.test(date)) {
                date = toInt(date)
            } else if (raspnetjson.test(date)) {
                date = +RegExp.$1
            } else {
                var trimDate = date.trim()
                var dateArray = [0, 0, 0, 0, 0, 0, 0]
                var oDate = new Date(0)
                //取得年月日
                trimDate = trimDate.replace(/^(\d+)\D(\d+)\D(\d+)/, function(_, a, b, c) {
                    var array = c.length === 4 ? [c, a, b] : [a, b, c]
                    dateArray[0] = toInt(array[0])     //年
                    dateArray[1] = toInt(array[1]) - 1 //月
                    dateArray[2] = toInt(array[2])     //日
                    return ""
                })
                var dateSetter = oDate.setFullYear
                var timeSetter = oDate.setHours
                trimDate = trimDate.replace(/[T\s](\d+):(\d+):?(\d+)?\.?(\d)?/, function(_, a, b, c, d) {
                    dateArray[3] = toInt(a) //小时
                    dateArray[4] = toInt(b) //分钟
                    dateArray[5] = toInt(c) //秒
                    if (d) {                //毫秒
                        dateArray[6] = Math.round(parseFloat("0." + d) * 1000)
                    }
                    return ""
                })
                var tzHour = 0
                var tzMin = 0
                trimDate = trimDate.replace(/Z|([+-])(\d\d):?(\d\d)/, function(z, symbol, c, d) {
                    dateSetter = oDate.setUTCFullYear
                    timeSetter = oDate.setUTCHours
                    if (symbol) {
                        tzHour = toInt(symbol + c)
                        tzMin = toInt(symbol + d)
                    }
                    return ""
                })

                dateArray[3] -= tzHour
                dateArray[4] -= tzMin
                dateSetter.apply(oDate, dateArray.slice(0, 3))
                timeSetter.apply(oDate, dateArray.slice(3))
                date = oDate
            }
        }
        if (typeof date === "number") {
            date = new Date(date)
        }
        if (avalon.type(date) !== "date") {
            return
        }
        while (format) {
            match = rdateFormat.exec(format)
            if (match) {
                parts = parts.concat(match.slice(1))
                format = parts.pop()
            } else {
                parts.push(format)
                format = null
            }
        }
        parts.forEach(function(value) {
            fn = DATE_FORMATS[value]
            text += fn ? fn(date, locate) : value.replace(/(^'|'$)/g, "").replace(/''/g, "'")
        })
        return text
    }
    var locate = {
        AMPMS: {
            0: "上午",
            1: "下午"
        },
        DAY: {
            0: "星期日",
            1: "星期一",
            2: "星期二",
            3: "星期三",
            4: "星期四",
            5: "星期五",
            6: "星期六"
        },
        MONTH: {
            0: "1月",
            1: "2月",
            2: "3月",
            3: "4月",
            4: "5月",
            5: "6月",
            6: "7月",
            7: "8月",
            8: "9月",
            9: "10月",
            10: "11月",
            11: "12月"
        },
        SHORTDAY: {
            "0": "周日",
            "1": "周一",
            "2": "周二",
            "3": "周三",
            "4": "周四",
            "5": "周五",
            "6": "周六"
        },
        fullDate: "y年M月d日EEEE",
        longDate: "y年M月d日",
        medium: "yyyy-M-d H:mm:ss",
        mediumDate: "yyyy-M-d",
        mediumTime: "H:mm:ss",
        "short": "yy-M-d ah:mm",
        shortDate: "yy-M-d",
        shortTime: "ah:mm"
    }
    locate.SHORTMONTH = locate.MONTH
    filters.date.locate = locate
}// jshint ignore:line
/*********************************************************************
 *                    DOMReady                                         *
 **********************************************************************/
var readyList = [],
    isReady
var fireReady = function (fn) {
    isReady = true
    var require = avalon.require
    if (require && require.checkDeps) {
        modules["domReady!"].state = 4
        require.checkDeps()
    }
    while (fn = readyList.shift()) {
        fn(avalon)
    }
}


if (DOC.readyState === "complete") {
    setTimeout(fireReady) //如果在domReady之外加载
} else {
    DOC.addEventListener("DOMContentLoaded", fireReady)
}
window.addEventListener("load", fireReady)
avalon.ready = function (fn) {
    if (!isReady) {
        readyList.push(fn)
    } else {
        fn(avalon)
    }
}
avalon.config({
    loader: true
})
avalon.ready(function () {
    avalon.scan(DOC.body)
})


// Register as a named AMD module, since avalon can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase avalon is used because AMD module names are
// derived from file names, and Avalon is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of avalon, it will work.

// Note that for maximum portability, libraries that are not avalon should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. avalon is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon
    if (typeof define === "function" && define.amd) {
        define("avalon", [], function() {
            return avalon
        })
    }
// Map over avalon in case of overwrite
    var _avalon = window.avalon
    avalon.noConflict = function(deep) {
        if (deep && window.avalon === avalon) {
            window.avalon = _avalon
        }
        return avalon
    }
// Expose avalon identifiers, even in AMD
// and CommonJS for browser emulators
    if (noGlobal === void 0) {
        window.avalon = avalon
    }
    return avalon

}));
define("entry/js/lib/avalon.modern.shim", function(){});

/**
 * Swiper 3.1.2
 * Most modern mobile touch slider and framework with hardware accelerated transitions
 * 
 * http://www.idangero.us/swiper/
 * 
 * Copyright 2015, Vladimir Kharlampidi
 * The iDangero.us
 * http://www.idangero.us/
 * 
 * Licensed under MIT
 * 
 * Released on: August 22, 2015
 */
!function(){"use strict";function e(e){e.fn.swiper=function(a){var s;return e(this).each(function(){var e=new t(this,a);s||(s=e)}),s}}var a,t=function(e,s){function r(){return"horizontal"===v.params.direction}function i(e){return Math.floor(e)}function n(){v.autoplayTimeoutId=setTimeout(function(){v.params.loop?(v.fixLoop(),v._slideNext()):v.isEnd?s.autoplayStopOnLast?v.stopAutoplay():v._slideTo(0):v._slideNext()},v.params.autoplay)}function o(e,t){var s=a(e.target);if(!s.is(t))if("string"==typeof t)s=s.parents(t);else if(t.nodeType){var r;return s.parents().each(function(e,a){a===t&&(r=t)}),r?t:void 0}return 0===s.length?void 0:s[0]}function l(e,a){a=a||{};var t=window.MutationObserver||window.WebkitMutationObserver,s=new t(function(e){e.forEach(function(e){v.onResize(!0),v.emit("onObserverUpdate",v,e)})});s.observe(e,{attributes:"undefined"==typeof a.attributes?!0:a.attributes,childList:"undefined"==typeof a.childList?!0:a.childList,characterData:"undefined"==typeof a.characterData?!0:a.characterData}),v.observers.push(s)}function p(e){e.originalEvent&&(e=e.originalEvent);var a=e.keyCode||e.charCode;if(!v.params.allowSwipeToNext&&(r()&&39===a||!r()&&40===a))return!1;if(!v.params.allowSwipeToPrev&&(r()&&37===a||!r()&&38===a))return!1;if(!(e.shiftKey||e.altKey||e.ctrlKey||e.metaKey||document.activeElement&&document.activeElement.nodeName&&("input"===document.activeElement.nodeName.toLowerCase()||"textarea"===document.activeElement.nodeName.toLowerCase()))){if(37===a||39===a||38===a||40===a){var t=!1;if(v.container.parents(".swiper-slide").length>0&&0===v.container.parents(".swiper-slide-active").length)return;var s={left:window.pageXOffset,top:window.pageYOffset},i=window.innerWidth,n=window.innerHeight,o=v.container.offset();v.rtl&&(o.left=o.left-v.container[0].scrollLeft);for(var l=[[o.left,o.top],[o.left+v.width,o.top],[o.left,o.top+v.height],[o.left+v.width,o.top+v.height]],p=0;p<l.length;p++){var d=l[p];d[0]>=s.left&&d[0]<=s.left+i&&d[1]>=s.top&&d[1]<=s.top+n&&(t=!0)}if(!t)return}r()?((37===a||39===a)&&(e.preventDefault?e.preventDefault():e.returnValue=!1),(39===a&&!v.rtl||37===a&&v.rtl)&&v.slideNext(),(37===a&&!v.rtl||39===a&&v.rtl)&&v.slidePrev()):((38===a||40===a)&&(e.preventDefault?e.preventDefault():e.returnValue=!1),40===a&&v.slideNext(),38===a&&v.slidePrev())}}function d(e){e.originalEvent&&(e=e.originalEvent);var a=v.mousewheel.event,t=0;if(e.detail)t=-e.detail;else if("mousewheel"===a)if(v.params.mousewheelForceToAxis)if(r()){if(!(Math.abs(e.wheelDeltaX)>Math.abs(e.wheelDeltaY)))return;t=e.wheelDeltaX}else{if(!(Math.abs(e.wheelDeltaY)>Math.abs(e.wheelDeltaX)))return;t=e.wheelDeltaY}else t=e.wheelDelta;else if("DOMMouseScroll"===a)t=-e.detail;else if("wheel"===a)if(v.params.mousewheelForceToAxis)if(r()){if(!(Math.abs(e.deltaX)>Math.abs(e.deltaY)))return;t=-e.deltaX}else{if(!(Math.abs(e.deltaY)>Math.abs(e.deltaX)))return;t=-e.deltaY}else t=Math.abs(e.deltaX)>Math.abs(e.deltaY)?-e.deltaX:-e.deltaY;if(v.params.mousewheelInvert&&(t=-t),v.params.freeMode){var s=v.getWrapperTranslate()+t*v.params.mousewheelSensitivity;if(s>0&&(s=0),s<v.maxTranslate()&&(s=v.maxTranslate()),v.setWrapperTransition(0),v.setWrapperTranslate(s),v.updateProgress(),v.updateActiveIndex(),v.params.freeModeSticky&&(clearTimeout(v.mousewheel.timeout),v.mousewheel.timeout=setTimeout(function(){v.slideReset()},300)),0===s||s===v.maxTranslate())return}else{if((new window.Date).getTime()-v.mousewheel.lastScrollTime>60)if(0>t)if(v.isEnd&&!v.params.loop||v.animating){if(v.params.mousewheelReleaseOnEdges)return!0}else v.slideNext();else if(v.isBeginning&&!v.params.loop||v.animating){if(v.params.mousewheelReleaseOnEdges)return!0}else v.slidePrev();v.mousewheel.lastScrollTime=(new window.Date).getTime()}return v.params.autoplay&&v.stopAutoplay(),e.preventDefault?e.preventDefault():e.returnValue=!1,!1}function u(e,t){e=a(e);var s,i,n;s=e.attr("data-swiper-parallax")||"0",i=e.attr("data-swiper-parallax-x"),n=e.attr("data-swiper-parallax-y"),i||n?(i=i||"0",n=n||"0"):r()?(i=s,n="0"):(n=s,i="0"),i=i.indexOf("%")>=0?parseInt(i,10)*t+"%":i*t+"px",n=n.indexOf("%")>=0?parseInt(n,10)*t+"%":n*t+"px",e.transform("translate3d("+i+", "+n+",0px)")}function c(e){return 0!==e.indexOf("on")&&(e=e[0]!==e[0].toUpperCase()?"on"+e[0].toUpperCase()+e.substring(1):"on"+e),e}if(!(this instanceof t))return new t(e,s);var m={direction:"horizontal",touchEventsTarget:"container",initialSlide:0,speed:300,autoplay:!1,autoplayDisableOnInteraction:!0,iOSEdgeSwipeDetection:!1,iOSEdgeSwipeThreshold:20,freeMode:!1,freeModeMomentum:!0,freeModeMomentumRatio:1,freeModeMomentumBounce:!0,freeModeMomentumBounceRatio:1,freeModeSticky:!1,setWrapperSize:!1,virtualTranslate:!1,effect:"slide",coverflow:{rotate:50,stretch:0,depth:100,modifier:1,slideShadows:!0},cube:{slideShadows:!0,shadow:!0,shadowOffset:20,shadowScale:.94},fade:{crossFade:!1},parallax:!1,scrollbar:null,scrollbarHide:!0,keyboardControl:!1,mousewheelControl:!1,mousewheelReleaseOnEdges:!1,mousewheelInvert:!1,mousewheelForceToAxis:!1,mousewheelSensitivity:1,hashnav:!1,spaceBetween:0,slidesPerView:1,slidesPerColumn:1,slidesPerColumnFill:"column",slidesPerGroup:1,centeredSlides:!1,slidesOffsetBefore:0,slidesOffsetAfter:0,roundLengths:!1,touchRatio:1,touchAngle:45,simulateTouch:!0,shortSwipes:!0,longSwipes:!0,longSwipesRatio:.5,longSwipesMs:300,followFinger:!0,onlyExternal:!1,threshold:0,touchMoveStopPropagation:!0,pagination:null,paginationElement:"span",paginationClickable:!1,paginationHide:!1,paginationBulletRender:null,resistance:!0,resistanceRatio:.85,nextButton:null,prevButton:null,watchSlidesProgress:!1,watchSlidesVisibility:!1,grabCursor:!1,preventClicks:!0,preventClicksPropagation:!0,slideToClickedSlide:!1,lazyLoading:!1,lazyLoadingInPrevNext:!1,lazyLoadingOnTransitionStart:!1,preloadImages:!0,updateOnImagesReady:!0,loop:!1,loopAdditionalSlides:0,loopedSlides:null,control:void 0,controlInverse:!1,controlBy:"slide",allowSwipeToPrev:!0,allowSwipeToNext:!0,swipeHandler:null,noSwiping:!0,noSwipingClass:"swiper-no-swiping",slideClass:"swiper-slide",slideActiveClass:"swiper-slide-active",slideVisibleClass:"swiper-slide-visible",slideDuplicateClass:"swiper-slide-duplicate",slideNextClass:"swiper-slide-next",slidePrevClass:"swiper-slide-prev",wrapperClass:"swiper-wrapper",bulletClass:"swiper-pagination-bullet",bulletActiveClass:"swiper-pagination-bullet-active",buttonDisabledClass:"swiper-button-disabled",paginationHiddenClass:"swiper-pagination-hidden",observer:!1,observeParents:!1,a11y:!1,prevSlideMessage:"Previous slide",nextSlideMessage:"Next slide",firstSlideMessage:"This is the first slide",lastSlideMessage:"This is the last slide",paginationBulletMessage:"Go to slide {{index}}",runCallbacksOnInit:!0},f=s&&s.virtualTranslate;s=s||{};for(var h in m)if("undefined"==typeof s[h])s[h]=m[h];else if("object"==typeof s[h])for(var g in m[h])"undefined"==typeof s[h][g]&&(s[h][g]=m[h][g]);var v=this;if(v.version="3.1.0",v.params=s,v.classNames=[],"undefined"!=typeof a&&"undefined"!=typeof Dom7&&(a=Dom7),("undefined"!=typeof a||(a="undefined"==typeof Dom7?window.Dom7||window.Zepto||window.jQuery:Dom7))&&(v.$=a,v.container=a(e),0!==v.container.length)){if(v.container.length>1)return void v.container.each(function(){new t(this,s)});v.container[0].swiper=v,v.container.data("swiper",v),v.classNames.push("swiper-container-"+v.params.direction),v.params.freeMode&&v.classNames.push("swiper-container-free-mode"),v.support.flexbox||(v.classNames.push("swiper-container-no-flexbox"),v.params.slidesPerColumn=1),(v.params.parallax||v.params.watchSlidesVisibility)&&(v.params.watchSlidesProgress=!0),["cube","coverflow"].indexOf(v.params.effect)>=0&&(v.support.transforms3d?(v.params.watchSlidesProgress=!0,v.classNames.push("swiper-container-3d")):v.params.effect="slide"),"slide"!==v.params.effect&&v.classNames.push("swiper-container-"+v.params.effect),"cube"===v.params.effect&&(v.params.resistanceRatio=0,v.params.slidesPerView=1,v.params.slidesPerColumn=1,v.params.slidesPerGroup=1,v.params.centeredSlides=!1,v.params.spaceBetween=0,v.params.virtualTranslate=!0,v.params.setWrapperSize=!1),"fade"===v.params.effect&&(v.params.slidesPerView=1,v.params.slidesPerColumn=1,v.params.slidesPerGroup=1,v.params.watchSlidesProgress=!0,v.params.spaceBetween=0,"undefined"==typeof f&&(v.params.virtualTranslate=!0)),v.params.grabCursor&&v.support.touch&&(v.params.grabCursor=!1),v.wrapper=v.container.children("."+v.params.wrapperClass),v.params.pagination&&(v.paginationContainer=a(v.params.pagination),v.params.paginationClickable&&v.paginationContainer.addClass("swiper-pagination-clickable")),v.rtl=r()&&("rtl"===v.container[0].dir.toLowerCase()||"rtl"===v.container.css("direction")),v.rtl&&v.classNames.push("swiper-container-rtl"),v.rtl&&(v.wrongRTL="-webkit-box"===v.wrapper.css("display")),v.params.slidesPerColumn>1&&v.classNames.push("swiper-container-multirow"),v.device.android&&v.classNames.push("swiper-container-android"),v.container.addClass(v.classNames.join(" ")),v.translate=0,v.progress=0,v.velocity=0,v.lockSwipeToNext=function(){v.params.allowSwipeToNext=!1},v.lockSwipeToPrev=function(){v.params.allowSwipeToPrev=!1},v.lockSwipes=function(){v.params.allowSwipeToNext=v.params.allowSwipeToPrev=!1},v.unlockSwipeToNext=function(){v.params.allowSwipeToNext=!0},v.unlockSwipeToPrev=function(){v.params.allowSwipeToPrev=!0},v.unlockSwipes=function(){v.params.allowSwipeToNext=v.params.allowSwipeToPrev=!0},v.params.grabCursor&&(v.container[0].style.cursor="move",v.container[0].style.cursor="-webkit-grab",v.container[0].style.cursor="-moz-grab",v.container[0].style.cursor="grab"),v.imagesToLoad=[],v.imagesLoaded=0,v.loadImage=function(e,a,t,s){function r(){s&&s()}var i;e.complete&&t?r():a?(i=new window.Image,i.onload=r,i.onerror=r,i.src=a):r()},v.preloadImages=function(){function e(){"undefined"!=typeof v&&null!==v&&(void 0!==v.imagesLoaded&&v.imagesLoaded++,v.imagesLoaded===v.imagesToLoad.length&&(v.params.updateOnImagesReady&&v.update(),v.emit("onImagesReady",v)))}v.imagesToLoad=v.container.find("img");for(var a=0;a<v.imagesToLoad.length;a++)v.loadImage(v.imagesToLoad[a],v.imagesToLoad[a].currentSrc||v.imagesToLoad[a].getAttribute("src"),!0,e)},v.autoplayTimeoutId=void 0,v.autoplaying=!1,v.autoplayPaused=!1,v.startAutoplay=function(){return"undefined"!=typeof v.autoplayTimeoutId?!1:v.params.autoplay?v.autoplaying?!1:(v.autoplaying=!0,v.emit("onAutoplayStart",v),void n()):!1},v.stopAutoplay=function(e){v.autoplayTimeoutId&&(v.autoplayTimeoutId&&clearTimeout(v.autoplayTimeoutId),v.autoplaying=!1,v.autoplayTimeoutId=void 0,v.emit("onAutoplayStop",v))},v.pauseAutoplay=function(e){v.autoplayPaused||(v.autoplayTimeoutId&&clearTimeout(v.autoplayTimeoutId),v.autoplayPaused=!0,0===e?(v.autoplayPaused=!1,n()):v.wrapper.transitionEnd(function(){v&&(v.autoplayPaused=!1,v.autoplaying?n():v.stopAutoplay())}))},v.minTranslate=function(){return-v.snapGrid[0]},v.maxTranslate=function(){return-v.snapGrid[v.snapGrid.length-1]},v.updateContainerSize=function(){var e,a;e="undefined"!=typeof v.params.width?v.params.width:v.container[0].clientWidth,a="undefined"!=typeof v.params.height?v.params.height:v.container[0].clientHeight,0===e&&r()||0===a&&!r()||(e=e-parseInt(v.container.css("padding-left"),10)-parseInt(v.container.css("padding-right"),10),a=a-parseInt(v.container.css("padding-top"),10)-parseInt(v.container.css("padding-bottom"),10),v.width=e,v.height=a,v.size=r()?v.width:v.height)},v.updateSlidesSize=function(){v.slides=v.wrapper.children("."+v.params.slideClass),v.snapGrid=[],v.slidesGrid=[],v.slidesSizesGrid=[];var e,a=v.params.spaceBetween,t=-v.params.slidesOffsetBefore,s=0,n=0;"string"==typeof a&&a.indexOf("%")>=0&&(a=parseFloat(a.replace("%",""))/100*v.size),v.virtualSize=-a,v.slides.css(v.rtl?{marginLeft:"",marginTop:""}:{marginRight:"",marginBottom:""});var o;v.params.slidesPerColumn>1&&(o=Math.floor(v.slides.length/v.params.slidesPerColumn)===v.slides.length/v.params.slidesPerColumn?v.slides.length:Math.ceil(v.slides.length/v.params.slidesPerColumn)*v.params.slidesPerColumn);var l,p=v.params.slidesPerColumn,d=o/p,u=d-(v.params.slidesPerColumn*d-v.slides.length);for(e=0;e<v.slides.length;e++){l=0;var c=v.slides.eq(e);if(v.params.slidesPerColumn>1){var m,f,h;"column"===v.params.slidesPerColumnFill?(f=Math.floor(e/p),h=e-f*p,(f>u||f===u&&h===p-1)&&++h>=p&&(h=0,f++),m=f+h*o/p,c.css({"-webkit-box-ordinal-group":m,"-moz-box-ordinal-group":m,"-ms-flex-order":m,"-webkit-order":m,order:m})):(h=Math.floor(e/d),f=e-h*d),c.css({"margin-top":0!==h&&v.params.spaceBetween&&v.params.spaceBetween+"px"}).attr("data-swiper-column",f).attr("data-swiper-row",h)}"none"!==c.css("display")&&("auto"===v.params.slidesPerView?(l=r()?c.outerWidth(!0):c.outerHeight(!0),v.params.roundLengths&&(l=i(l))):(l=(v.size-(v.params.slidesPerView-1)*a)/v.params.slidesPerView,v.params.roundLengths&&(l=i(l)),r()?v.slides[e].style.width=l+"px":v.slides[e].style.height=l+"px"),v.slides[e].swiperSlideSize=l,v.slidesSizesGrid.push(l),v.params.centeredSlides?(t=t+l/2+s/2+a,0===e&&(t=t-v.size/2-a),Math.abs(t)<.001&&(t=0),n%v.params.slidesPerGroup===0&&v.snapGrid.push(t),v.slidesGrid.push(t)):(n%v.params.slidesPerGroup===0&&v.snapGrid.push(t),v.slidesGrid.push(t),t=t+l+a),v.virtualSize+=l+a,s=l,n++)}v.virtualSize=Math.max(v.virtualSize,v.size)+v.params.slidesOffsetAfter;var g;if(v.rtl&&v.wrongRTL&&("slide"===v.params.effect||"coverflow"===v.params.effect)&&v.wrapper.css({width:v.virtualSize+v.params.spaceBetween+"px"}),(!v.support.flexbox||v.params.setWrapperSize)&&v.wrapper.css(r()?{width:v.virtualSize+v.params.spaceBetween+"px"}:{height:v.virtualSize+v.params.spaceBetween+"px"}),v.params.slidesPerColumn>1&&(v.virtualSize=(l+v.params.spaceBetween)*o,v.virtualSize=Math.ceil(v.virtualSize/v.params.slidesPerColumn)-v.params.spaceBetween,v.wrapper.css({width:v.virtualSize+v.params.spaceBetween+"px"}),v.params.centeredSlides)){for(g=[],e=0;e<v.snapGrid.length;e++)v.snapGrid[e]<v.virtualSize+v.snapGrid[0]&&g.push(v.snapGrid[e]);v.snapGrid=g}if(!v.params.centeredSlides){for(g=[],e=0;e<v.snapGrid.length;e++)v.snapGrid[e]<=v.virtualSize-v.size&&g.push(v.snapGrid[e]);v.snapGrid=g,Math.floor(v.virtualSize-v.size)>Math.floor(v.snapGrid[v.snapGrid.length-1])&&v.snapGrid.push(v.virtualSize-v.size)}0===v.snapGrid.length&&(v.snapGrid=[0]),0!==v.params.spaceBetween&&v.slides.css(r()?v.rtl?{marginLeft:a+"px"}:{marginRight:a+"px"}:{marginBottom:a+"px"}),v.params.watchSlidesProgress&&v.updateSlidesOffset()},v.updateSlidesOffset=function(){for(var e=0;e<v.slides.length;e++)v.slides[e].swiperSlideOffset=r()?v.slides[e].offsetLeft:v.slides[e].offsetTop},v.updateSlidesProgress=function(e){if("undefined"==typeof e&&(e=v.translate||0),0!==v.slides.length){"undefined"==typeof v.slides[0].swiperSlideOffset&&v.updateSlidesOffset();var a=-e;v.rtl&&(a=e);{v.container[0].getBoundingClientRect(),r()?"left":"top",r()?"right":"bottom"}v.slides.removeClass(v.params.slideVisibleClass);for(var t=0;t<v.slides.length;t++){var s=v.slides[t],i=(a-s.swiperSlideOffset)/(s.swiperSlideSize+v.params.spaceBetween);if(v.params.watchSlidesVisibility){var n=-(a-s.swiperSlideOffset),o=n+v.slidesSizesGrid[t],l=n>=0&&n<v.size||o>0&&o<=v.size||0>=n&&o>=v.size;l&&v.slides.eq(t).addClass(v.params.slideVisibleClass)}s.progress=v.rtl?-i:i}}},v.updateProgress=function(e){"undefined"==typeof e&&(e=v.translate||0);var a=v.maxTranslate()-v.minTranslate();0===a?(v.progress=0,v.isBeginning=v.isEnd=!0):(v.progress=(e-v.minTranslate())/a,v.isBeginning=v.progress<=0,v.isEnd=v.progress>=1),v.isBeginning&&v.emit("onReachBeginning",v),v.isEnd&&v.emit("onReachEnd",v),v.params.watchSlidesProgress&&v.updateSlidesProgress(e),v.emit("onProgress",v,v.progress)},v.updateActiveIndex=function(){var e,a,t,s=v.rtl?v.translate:-v.translate;for(a=0;a<v.slidesGrid.length;a++)"undefined"!=typeof v.slidesGrid[a+1]?s>=v.slidesGrid[a]&&s<v.slidesGrid[a+1]-(v.slidesGrid[a+1]-v.slidesGrid[a])/2?e=a:s>=v.slidesGrid[a]&&s<v.slidesGrid[a+1]&&(e=a+1):s>=v.slidesGrid[a]&&(e=a);(0>e||"undefined"==typeof e)&&(e=0),t=Math.floor(e/v.params.slidesPerGroup),t>=v.snapGrid.length&&(t=v.snapGrid.length-1),e!==v.activeIndex&&(v.snapIndex=t,v.previousIndex=v.activeIndex,v.activeIndex=e,v.updateClasses())},v.updateClasses=function(){v.slides.removeClass(v.params.slideActiveClass+" "+v.params.slideNextClass+" "+v.params.slidePrevClass);var e=v.slides.eq(v.activeIndex);if(e.addClass(v.params.slideActiveClass),e.next("."+v.params.slideClass).addClass(v.params.slideNextClass),e.prev("."+v.params.slideClass).addClass(v.params.slidePrevClass),v.bullets&&v.bullets.length>0){v.bullets.removeClass(v.params.bulletActiveClass);var t;v.params.loop?(t=Math.ceil(v.activeIndex-v.loopedSlides)/v.params.slidesPerGroup,t>v.slides.length-1-2*v.loopedSlides&&(t-=v.slides.length-2*v.loopedSlides),t>v.bullets.length-1&&(t-=v.bullets.length)):t="undefined"!=typeof v.snapIndex?v.snapIndex:v.activeIndex||0,v.paginationContainer.length>1?v.bullets.each(function(){a(this).index()===t&&a(this).addClass(v.params.bulletActiveClass)}):v.bullets.eq(t).addClass(v.params.bulletActiveClass)}v.params.loop||(v.params.prevButton&&(v.isBeginning?(a(v.params.prevButton).addClass(v.params.buttonDisabledClass),v.params.a11y&&v.a11y&&v.a11y.disable(a(v.params.prevButton))):(a(v.params.prevButton).removeClass(v.params.buttonDisabledClass),v.params.a11y&&v.a11y&&v.a11y.enable(a(v.params.prevButton)))),v.params.nextButton&&(v.isEnd?(a(v.params.nextButton).addClass(v.params.buttonDisabledClass),v.params.a11y&&v.a11y&&v.a11y.disable(a(v.params.nextButton))):(a(v.params.nextButton).removeClass(v.params.buttonDisabledClass),v.params.a11y&&v.a11y&&v.a11y.enable(a(v.params.nextButton)))))},v.updatePagination=function(){if(v.params.pagination&&v.paginationContainer&&v.paginationContainer.length>0){for(var e="",a=v.params.loop?Math.ceil((v.slides.length-2*v.loopedSlides)/v.params.slidesPerGroup):v.snapGrid.length,t=0;a>t;t++)e+=v.params.paginationBulletRender?v.params.paginationBulletRender(t,v.params.bulletClass):"<"+v.params.paginationElement+' class="'+v.params.bulletClass+'"></'+v.params.paginationElement+">";v.paginationContainer.html(e),v.bullets=v.paginationContainer.find("."+v.params.bulletClass),v.params.paginationClickable&&v.params.a11y&&v.a11y&&v.a11y.initPagination()}},v.update=function(e){function a(){s=Math.min(Math.max(v.translate,v.maxTranslate()),v.minTranslate()),v.setWrapperTranslate(s),v.updateActiveIndex(),v.updateClasses()}if(v.updateContainerSize(),v.updateSlidesSize(),v.updateProgress(),v.updatePagination(),v.updateClasses(),v.params.scrollbar&&v.scrollbar&&v.scrollbar.set(),e){var t,s;v.controller&&v.controller.spline&&(v.controller.spline=void 0),v.params.freeMode?a():(t=("auto"===v.params.slidesPerView||v.params.slidesPerView>1)&&v.isEnd&&!v.params.centeredSlides?v.slideTo(v.slides.length-1,0,!1,!0):v.slideTo(v.activeIndex,0,!1,!0),t||a())}},v.onResize=function(e){var a=v.params.allowSwipeToPrev,t=v.params.allowSwipeToNext;if(v.params.allowSwipeToPrev=v.params.allowSwipeToNext=!0,v.updateContainerSize(),v.updateSlidesSize(),("auto"===v.params.slidesPerView||v.params.freeMode||e)&&v.updatePagination(),v.params.scrollbar&&v.scrollbar&&v.scrollbar.set(),v.controller&&v.controller.spline&&(v.controller.spline=void 0),v.params.freeMode){var s=Math.min(Math.max(v.translate,v.maxTranslate()),v.minTranslate());v.setWrapperTranslate(s),v.updateActiveIndex(),v.updateClasses()}else v.updateClasses(),("auto"===v.params.slidesPerView||v.params.slidesPerView>1)&&v.isEnd&&!v.params.centeredSlides?v.slideTo(v.slides.length-1,0,!1,!0):v.slideTo(v.activeIndex,0,!1,!0);v.params.allowSwipeToPrev=a,v.params.allowSwipeToNext=t};var w=["mousedown","mousemove","mouseup"];window.navigator.pointerEnabled?w=["pointerdown","pointermove","pointerup"]:window.navigator.msPointerEnabled&&(w=["MSPointerDown","MSPointerMove","MSPointerUp"]),v.touchEvents={start:v.support.touch||!v.params.simulateTouch?"touchstart":w[0],move:v.support.touch||!v.params.simulateTouch?"touchmove":w[1],end:v.support.touch||!v.params.simulateTouch?"touchend":w[2]},(window.navigator.pointerEnabled||window.navigator.msPointerEnabled)&&("container"===v.params.touchEventsTarget?v.container:v.wrapper).addClass("swiper-wp8-"+v.params.direction),v.initEvents=function(e){var t=e?"off":"on",r=e?"removeEventListener":"addEventListener",i="container"===v.params.touchEventsTarget?v.container[0]:v.wrapper[0],n=v.support.touch?i:document,o=v.params.nested?!0:!1;v.browser.ie?(i[r](v.touchEvents.start,v.onTouchStart,!1),n[r](v.touchEvents.move,v.onTouchMove,o),n[r](v.touchEvents.end,v.onTouchEnd,!1)):(v.support.touch&&(i[r](v.touchEvents.start,v.onTouchStart,!1),i[r](v.touchEvents.move,v.onTouchMove,o),i[r](v.touchEvents.end,v.onTouchEnd,!1)),!s.simulateTouch||v.device.ios||v.device.android||(i[r]("mousedown",v.onTouchStart,!1),document[r]("mousemove",v.onTouchMove,o),document[r]("mouseup",v.onTouchEnd,!1))),window[r]("resize",v.onResize),v.params.nextButton&&(a(v.params.nextButton)[t]("click",v.onClickNext),v.params.a11y&&v.a11y&&a(v.params.nextButton)[t]("keydown",v.a11y.onEnterKey)),v.params.prevButton&&(a(v.params.prevButton)[t]("click",v.onClickPrev),v.params.a11y&&v.a11y&&a(v.params.prevButton)[t]("keydown",v.a11y.onEnterKey)),v.params.pagination&&v.params.paginationClickable&&(a(v.paginationContainer)[t]("click","."+v.params.bulletClass,v.onClickIndex),v.params.a11y&&v.a11y&&a(v.paginationContainer)[t]("keydown","."+v.params.bulletClass,v.a11y.onEnterKey)),(v.params.preventClicks||v.params.preventClicksPropagation)&&i[r]("click",v.preventClicks,!0)},v.attachEvents=function(e){v.initEvents()},v.detachEvents=function(){v.initEvents(!0)},v.allowClick=!0,v.preventClicks=function(e){v.allowClick||(v.params.preventClicks&&e.preventDefault(),v.params.preventClicksPropagation&&v.animating&&(e.stopPropagation(),e.stopImmediatePropagation()))},v.onClickNext=function(e){e.preventDefault(),(!v.isEnd||v.params.loop)&&v.slideNext()},v.onClickPrev=function(e){e.preventDefault(),(!v.isBeginning||v.params.loop)&&v.slidePrev()},v.onClickIndex=function(e){e.preventDefault();var t=a(this).index()*v.params.slidesPerGroup;v.params.loop&&(t+=v.loopedSlides),v.slideTo(t)},v.updateClickedSlide=function(e){var t=o(e,"."+v.params.slideClass),s=!1;if(t)for(var r=0;r<v.slides.length;r++)v.slides[r]===t&&(s=!0);if(!t||!s)return v.clickedSlide=void 0,void(v.clickedIndex=void 0);if(v.clickedSlide=t,v.clickedIndex=a(t).index(),v.params.slideToClickedSlide&&void 0!==v.clickedIndex&&v.clickedIndex!==v.activeIndex){var i,n=v.clickedIndex;if(v.params.loop)if(i=a(v.clickedSlide).attr("data-swiper-slide-index"),n>v.slides.length-v.params.slidesPerView)v.fixLoop(),n=v.wrapper.children("."+v.params.slideClass+'[data-swiper-slide-index="'+i+'"]').eq(0).index(),setTimeout(function(){v.slideTo(n)},0);else if(n<v.params.slidesPerView-1){v.fixLoop();var l=v.wrapper.children("."+v.params.slideClass+'[data-swiper-slide-index="'+i+'"]');n=l.eq(l.length-1).index(),setTimeout(function(){v.slideTo(n)},0)}else v.slideTo(n);else v.slideTo(n)}};var y,x,b,T,S,C,M,P,z,I="input, select, textarea, button",E=Date.now(),k=[];v.animating=!1,v.touches={startX:0,startY:0,currentX:0,currentY:0,diff:0};var D,G;if(v.onTouchStart=function(e){if(e.originalEvent&&(e=e.originalEvent),D="touchstart"===e.type,D||!("which"in e)||3!==e.which){if(v.params.noSwiping&&o(e,"."+v.params.noSwipingClass))return void(v.allowClick=!0);if(!v.params.swipeHandler||o(e,v.params.swipeHandler)){var t=v.touches.currentX="touchstart"===e.type?e.targetTouches[0].pageX:e.pageX,s=v.touches.currentY="touchstart"===e.type?e.targetTouches[0].pageY:e.pageY;if(!(v.device.ios&&v.params.iOSEdgeSwipeDetection&&t<=v.params.iOSEdgeSwipeThreshold)){if(y=!0,x=!1,T=void 0,G=void 0,v.touches.startX=t,v.touches.startY=s,b=Date.now(),v.allowClick=!0,v.updateContainerSize(),v.swipeDirection=void 0,v.params.threshold>0&&(M=!1),"touchstart"!==e.type){var r=!0;a(e.target).is(I)&&(r=!1),document.activeElement&&a(document.activeElement).is(I)&&document.activeElement.blur(),r&&e.preventDefault()}v.emit("onTouchStart",v,e)}}}},v.onTouchMove=function(e){if(e.originalEvent&&(e=e.originalEvent),!(D&&"mousemove"===e.type||e.preventedByNestedSwiper)){if(v.params.onlyExternal)return v.allowClick=!1,void(y&&(v.touches.startX=v.touches.currentX="touchmove"===e.type?e.targetTouches[0].pageX:e.pageX,v.touches.startY=v.touches.currentY="touchmove"===e.type?e.targetTouches[0].pageY:e.pageY,b=Date.now()));if(D&&document.activeElement&&e.target===document.activeElement&&a(e.target).is(I))return x=!0,void(v.allowClick=!1);if(v.emit("onTouchMove",v,e),!(e.targetTouches&&e.targetTouches.length>1)){if(v.touches.currentX="touchmove"===e.type?e.targetTouches[0].pageX:e.pageX,v.touches.currentY="touchmove"===e.type?e.targetTouches[0].pageY:e.pageY,"undefined"==typeof T){var t=180*Math.atan2(Math.abs(v.touches.currentY-v.touches.startY),Math.abs(v.touches.currentX-v.touches.startX))/Math.PI;T=r()?t>v.params.touchAngle:90-t>v.params.touchAngle}if(T&&v.emit("onTouchMoveOpposite",v,e),"undefined"==typeof G&&v.browser.ieTouch&&(v.touches.currentX!==v.touches.startX||v.touches.currentY!==v.touches.startY)&&(G=!0),y){if(T)return void(y=!1);if(G||!v.browser.ieTouch){v.allowClick=!1,v.emit("onSliderMove",v,e),e.preventDefault(),v.params.touchMoveStopPropagation&&!v.params.nested&&e.stopPropagation(),x||(s.loop&&v.fixLoop(),C=v.getWrapperTranslate(),v.setWrapperTransition(0),v.animating&&v.wrapper.trigger("webkitTransitionEnd transitionend oTransitionEnd MSTransitionEnd msTransitionEnd"),v.params.autoplay&&v.autoplaying&&(v.params.autoplayDisableOnInteraction?v.stopAutoplay():v.pauseAutoplay()),z=!1,v.params.grabCursor&&(v.container[0].style.cursor="move",v.container[0].style.cursor="-webkit-grabbing",v.container[0].style.cursor="-moz-grabbin",v.container[0].style.cursor="grabbing")),x=!0;var i=v.touches.diff=r()?v.touches.currentX-v.touches.startX:v.touches.currentY-v.touches.startY;i*=v.params.touchRatio,v.rtl&&(i=-i),v.swipeDirection=i>0?"prev":"next",S=i+C;var n=!0;if(i>0&&S>v.minTranslate()?(n=!1,v.params.resistance&&(S=v.minTranslate()-1+Math.pow(-v.minTranslate()+C+i,v.params.resistanceRatio))):0>i&&S<v.maxTranslate()&&(n=!1,v.params.resistance&&(S=v.maxTranslate()+1-Math.pow(v.maxTranslate()-C-i,v.params.resistanceRatio))),n&&(e.preventedByNestedSwiper=!0),!v.params.allowSwipeToNext&&"next"===v.swipeDirection&&C>S&&(S=C),!v.params.allowSwipeToPrev&&"prev"===v.swipeDirection&&S>C&&(S=C),v.params.followFinger){if(v.params.threshold>0){if(!(Math.abs(i)>v.params.threshold||M))return void(S=C);if(!M)return M=!0,v.touches.startX=v.touches.currentX,v.touches.startY=v.touches.currentY,S=C,void(v.touches.diff=r()?v.touches.currentX-v.touches.startX:v.touches.currentY-v.touches.startY)}(v.params.freeMode||v.params.watchSlidesProgress)&&v.updateActiveIndex(),v.params.freeMode&&(0===k.length&&k.push({position:v.touches[r()?"startX":"startY"],time:b}),k.push({position:v.touches[r()?"currentX":"currentY"],time:(new window.Date).getTime()})),v.updateProgress(S),v.setWrapperTranslate(S)}}}}}},v.onTouchEnd=function(e){if(e.originalEvent&&(e=e.originalEvent),v.emit("onTouchEnd",v,e),y){v.params.grabCursor&&x&&y&&(v.container[0].style.cursor="move",v.container[0].style.cursor="-webkit-grab",v.container[0].style.cursor="-moz-grab",v.container[0].style.cursor="grab");var t=Date.now(),s=t-b;if(v.allowClick&&(v.updateClickedSlide(e),v.emit("onTap",v,e),300>s&&t-E>300&&(P&&clearTimeout(P),P=setTimeout(function(){v&&(v.params.paginationHide&&v.paginationContainer.length>0&&!a(e.target).hasClass(v.params.bulletClass)&&v.paginationContainer.toggleClass(v.params.paginationHiddenClass),v.emit("onClick",v,e))},300)),300>s&&300>t-E&&(P&&clearTimeout(P),v.emit("onDoubleTap",v,e))),E=Date.now(),setTimeout(function(){v&&(v.allowClick=!0)},0),!y||!x||!v.swipeDirection||0===v.touches.diff||S===C)return void(y=x=!1);y=x=!1;var r;if(r=v.params.followFinger?v.rtl?v.translate:-v.translate:-S,v.params.freeMode){if(r<-v.minTranslate())return void v.slideTo(v.activeIndex);if(r>-v.maxTranslate())return void v.slideTo(v.slides.length<v.snapGrid.length?v.snapGrid.length-1:v.slides.length-1);if(v.params.freeModeMomentum){if(k.length>1){var i=k.pop(),n=k.pop(),o=i.position-n.position,l=i.time-n.time;v.velocity=o/l,v.velocity=v.velocity/2,Math.abs(v.velocity)<.02&&(v.velocity=0),(l>150||(new window.Date).getTime()-i.time>300)&&(v.velocity=0)}else v.velocity=0;k.length=0;var p=1e3*v.params.freeModeMomentumRatio,d=v.velocity*p,u=v.translate+d;v.rtl&&(u=-u);var c,m=!1,f=20*Math.abs(v.velocity)*v.params.freeModeMomentumBounceRatio;if(u<v.maxTranslate())v.params.freeModeMomentumBounce?(u+v.maxTranslate()<-f&&(u=v.maxTranslate()-f),c=v.maxTranslate(),m=!0,z=!0):u=v.maxTranslate();else if(u>v.minTranslate())v.params.freeModeMomentumBounce?(u-v.minTranslate()>f&&(u=v.minTranslate()+f),c=v.minTranslate(),m=!0,z=!0):u=v.minTranslate();else if(v.params.freeModeSticky){var h,g=0;for(g=0;g<v.snapGrid.length;g+=1)if(v.snapGrid[g]>-u){h=g;break}u=Math.abs(v.snapGrid[h]-u)<Math.abs(v.snapGrid[h-1]-u)||"next"===v.swipeDirection?v.snapGrid[h]:v.snapGrid[h-1],v.rtl||(u=-u)}if(0!==v.velocity)p=Math.abs(v.rtl?(-u-v.translate)/v.velocity:(u-v.translate)/v.velocity);else if(v.params.freeModeSticky)return void v.slideReset();v.params.freeModeMomentumBounce&&m?(v.updateProgress(c),v.setWrapperTransition(p),v.setWrapperTranslate(u),v.onTransitionStart(),v.animating=!0,v.wrapper.transitionEnd(function(){v&&z&&(v.emit("onMomentumBounce",v),v.setWrapperTransition(v.params.speed),v.setWrapperTranslate(c),v.wrapper.transitionEnd(function(){v&&v.onTransitionEnd()}))})):v.velocity?(v.updateProgress(u),v.setWrapperTransition(p),v.setWrapperTranslate(u),v.onTransitionStart(),v.animating||(v.animating=!0,v.wrapper.transitionEnd(function(){v&&v.onTransitionEnd()}))):v.updateProgress(u),v.updateActiveIndex()}return void((!v.params.freeModeMomentum||s>=v.params.longSwipesMs)&&(v.updateProgress(),v.updateActiveIndex()))}var w,T=0,M=v.slidesSizesGrid[0];for(w=0;w<v.slidesGrid.length;w+=v.params.slidesPerGroup)"undefined"!=typeof v.slidesGrid[w+v.params.slidesPerGroup]?r>=v.slidesGrid[w]&&r<v.slidesGrid[w+v.params.slidesPerGroup]&&(T=w,M=v.slidesGrid[w+v.params.slidesPerGroup]-v.slidesGrid[w]):r>=v.slidesGrid[w]&&(T=w,M=v.slidesGrid[v.slidesGrid.length-1]-v.slidesGrid[v.slidesGrid.length-2]);var I=(r-v.slidesGrid[T])/M;if(s>v.params.longSwipesMs){if(!v.params.longSwipes)return void v.slideTo(v.activeIndex);"next"===v.swipeDirection&&v.slideTo(I>=v.params.longSwipesRatio?T+v.params.slidesPerGroup:T),"prev"===v.swipeDirection&&v.slideTo(I>1-v.params.longSwipesRatio?T+v.params.slidesPerGroup:T)}else{if(!v.params.shortSwipes)return void v.slideTo(v.activeIndex);"next"===v.swipeDirection&&v.slideTo(T+v.params.slidesPerGroup),"prev"===v.swipeDirection&&v.slideTo(T)}}},v._slideTo=function(e,a){return v.slideTo(e,a,!0,!0)},v.slideTo=function(e,a,t,s){"undefined"==typeof t&&(t=!0),"undefined"==typeof e&&(e=0),0>e&&(e=0),v.snapIndex=Math.floor(e/v.params.slidesPerGroup),v.snapIndex>=v.snapGrid.length&&(v.snapIndex=v.snapGrid.length-1);var i=-v.snapGrid[v.snapIndex];v.params.autoplay&&v.autoplaying&&(s||!v.params.autoplayDisableOnInteraction?v.pauseAutoplay(a):v.stopAutoplay()),v.updateProgress(i);for(var n=0;n<v.slidesGrid.length;n++)-Math.floor(100*i)>=Math.floor(100*v.slidesGrid[n])&&(e=n);if(!v.params.allowSwipeToNext&&i<v.translate&&i<v.minTranslate())return!1;if(!v.params.allowSwipeToPrev&&i>v.translate&&i>v.maxTranslate()&&(v.activeIndex||0)!==e)return!1;if("undefined"==typeof a&&(a=v.params.speed),v.previousIndex=v.activeIndex||0,v.activeIndex=e,i===v.translate)return v.updateClasses(),!1;v.updateClasses(),v.onTransitionStart(t);r()?i:0,r()?0:i;return 0===a?(v.setWrapperTransition(0),v.setWrapperTranslate(i),v.onTransitionEnd(t)):(v.setWrapperTransition(a),v.setWrapperTranslate(i),v.animating||(v.animating=!0,v.wrapper.transitionEnd(function(){v&&v.onTransitionEnd(t)}))),!0},v.onTransitionStart=function(e){"undefined"==typeof e&&(e=!0),
v.lazy&&v.lazy.onTransitionStart(),e&&(v.emit("onTransitionStart",v),v.activeIndex!==v.previousIndex&&v.emit("onSlideChangeStart",v))},v.onTransitionEnd=function(e){v.animating=!1,v.setWrapperTransition(0),"undefined"==typeof e&&(e=!0),v.lazy&&v.lazy.onTransitionEnd(),e&&(v.emit("onTransitionEnd",v),v.activeIndex!==v.previousIndex&&v.emit("onSlideChangeEnd",v)),v.params.hashnav&&v.hashnav&&v.hashnav.setHash()},v.slideNext=function(e,a,t){if(v.params.loop){if(v.animating)return!1;v.fixLoop();{v.container[0].clientLeft}return v.slideTo(v.activeIndex+v.params.slidesPerGroup,a,e,t)}return v.slideTo(v.activeIndex+v.params.slidesPerGroup,a,e,t)},v._slideNext=function(e){return v.slideNext(!0,e,!0)},v.slidePrev=function(e,a,t){if(v.params.loop){if(v.animating)return!1;v.fixLoop();{v.container[0].clientLeft}return v.slideTo(v.activeIndex-1,a,e,t)}return v.slideTo(v.activeIndex-1,a,e,t)},v._slidePrev=function(e){return v.slidePrev(!0,e,!0)},v.slideReset=function(e,a,t){return v.slideTo(v.activeIndex,a,e)},v.setWrapperTransition=function(e,a){v.wrapper.transition(e),"slide"!==v.params.effect&&v.effects[v.params.effect]&&v.effects[v.params.effect].setTransition(e),v.params.parallax&&v.parallax&&v.parallax.setTransition(e),v.params.scrollbar&&v.scrollbar&&v.scrollbar.setTransition(e),v.params.control&&v.controller&&v.controller.setTransition(e,a),v.emit("onSetTransition",v,e)},v.setWrapperTranslate=function(e,a,t){var s=0,i=0,n=0;r()?s=v.rtl?-e:e:i=e,v.params.virtualTranslate||v.wrapper.transform(v.support.transforms3d?"translate3d("+s+"px, "+i+"px, "+n+"px)":"translate("+s+"px, "+i+"px)"),v.translate=r()?s:i,a&&v.updateActiveIndex(),"slide"!==v.params.effect&&v.effects[v.params.effect]&&v.effects[v.params.effect].setTranslate(v.translate),v.params.parallax&&v.parallax&&v.parallax.setTranslate(v.translate),v.params.scrollbar&&v.scrollbar&&v.scrollbar.setTranslate(v.translate),v.params.control&&v.controller&&v.controller.setTranslate(v.translate,t),v.emit("onSetTranslate",v,v.translate)},v.getTranslate=function(e,a){var t,s,r,i;return"undefined"==typeof a&&(a="x"),v.params.virtualTranslate?v.rtl?-v.translate:v.translate:(r=window.getComputedStyle(e,null),window.WebKitCSSMatrix?i=new window.WebKitCSSMatrix("none"===r.webkitTransform?"":r.webkitTransform):(i=r.MozTransform||r.OTransform||r.MsTransform||r.msTransform||r.transform||r.getPropertyValue("transform").replace("translate(","matrix(1, 0, 0, 1,"),t=i.toString().split(",")),"x"===a&&(s=window.WebKitCSSMatrix?i.m41:parseFloat(16===t.length?t[12]:t[4])),"y"===a&&(s=window.WebKitCSSMatrix?i.m42:parseFloat(16===t.length?t[13]:t[5])),v.rtl&&s&&(s=-s),s||0)},v.getWrapperTranslate=function(e){return"undefined"==typeof e&&(e=r()?"x":"y"),v.getTranslate(v.wrapper[0],e)},v.observers=[],v.initObservers=function(){if(v.params.observeParents)for(var e=v.container.parents(),a=0;a<e.length;a++)l(e[a]);l(v.container[0],{childList:!1}),l(v.wrapper[0],{attributes:!1})},v.disconnectObservers=function(){for(var e=0;e<v.observers.length;e++)v.observers[e].disconnect();v.observers=[]},v.createLoop=function(){v.wrapper.children("."+v.params.slideClass+"."+v.params.slideDuplicateClass).remove();var e=v.wrapper.children("."+v.params.slideClass);"auto"!==v.params.slidesPerView||v.params.loopedSlides||(v.params.loopedSlides=e.length),v.loopedSlides=parseInt(v.params.loopedSlides||v.params.slidesPerView,10),v.loopedSlides=v.loopedSlides+v.params.loopAdditionalSlides,v.loopedSlides>e.length&&(v.loopedSlides=e.length);var t,s=[],r=[];for(e.each(function(t,i){var n=a(this);t<v.loopedSlides&&r.push(i),t<e.length&&t>=e.length-v.loopedSlides&&s.push(i),n.attr("data-swiper-slide-index",t)}),t=0;t<r.length;t++)v.wrapper.append(a(r[t].cloneNode(!0)).addClass(v.params.slideDuplicateClass));for(t=s.length-1;t>=0;t--)v.wrapper.prepend(a(s[t].cloneNode(!0)).addClass(v.params.slideDuplicateClass))},v.destroyLoop=function(){v.wrapper.children("."+v.params.slideClass+"."+v.params.slideDuplicateClass).remove(),v.slides.removeAttr("data-swiper-slide-index")},v.fixLoop=function(){var e;v.activeIndex<v.loopedSlides?(e=v.slides.length-3*v.loopedSlides+v.activeIndex,e+=v.loopedSlides,v.slideTo(e,0,!1,!0)):("auto"===v.params.slidesPerView&&v.activeIndex>=2*v.loopedSlides||v.activeIndex>v.slides.length-2*v.params.slidesPerView)&&(e=-v.slides.length+v.activeIndex+v.loopedSlides,e+=v.loopedSlides,v.slideTo(e,0,!1,!0))},v.appendSlide=function(e){if(v.params.loop&&v.destroyLoop(),"object"==typeof e&&e.length)for(var a=0;a<e.length;a++)e[a]&&v.wrapper.append(e[a]);else v.wrapper.append(e);v.params.loop&&v.createLoop(),v.params.observer&&v.support.observer||v.update(!0)},v.prependSlide=function(e){v.params.loop&&v.destroyLoop();var a=v.activeIndex+1;if("object"==typeof e&&e.length){for(var t=0;t<e.length;t++)e[t]&&v.wrapper.prepend(e[t]);a=v.activeIndex+e.length}else v.wrapper.prepend(e);v.params.loop&&v.createLoop(),v.params.observer&&v.support.observer||v.update(!0),v.slideTo(a,0,!1)},v.removeSlide=function(e){v.params.loop&&(v.destroyLoop(),v.slides=v.wrapper.children("."+v.params.slideClass));var a,t=v.activeIndex;if("object"==typeof e&&e.length){for(var s=0;s<e.length;s++)a=e[s],v.slides[a]&&v.slides.eq(a).remove(),t>a&&t--;t=Math.max(t,0)}else a=e,v.slides[a]&&v.slides.eq(a).remove(),t>a&&t--,t=Math.max(t,0);v.params.loop&&v.createLoop(),v.params.observer&&v.support.observer||v.update(!0),v.params.loop?v.slideTo(t+v.loopedSlides,0,!1):v.slideTo(t,0,!1)},v.removeAllSlides=function(){for(var e=[],a=0;a<v.slides.length;a++)e.push(a);v.removeSlide(e)},v.effects={fade:{setTranslate:function(){for(var e=0;e<v.slides.length;e++){var a=v.slides.eq(e),t=a[0].swiperSlideOffset,s=-t;v.params.virtualTranslate||(s-=v.translate);var i=0;r()||(i=s,s=0);var n=v.params.fade.crossFade?Math.max(1-Math.abs(a[0].progress),0):1+Math.min(Math.max(a[0].progress,-1),0);a.css({opacity:n}).transform("translate3d("+s+"px, "+i+"px, 0px)")}},setTransition:function(e){if(v.slides.transition(e),v.params.virtualTranslate&&0!==e){var a=!1;v.slides.transitionEnd(function(){if(!a&&v){a=!0,v.animating=!1;for(var e=["webkitTransitionEnd","transitionend","oTransitionEnd","MSTransitionEnd","msTransitionEnd"],t=0;t<e.length;t++)v.wrapper.trigger(e[t])}})}}},cube:{setTranslate:function(){var e,t=0;v.params.cube.shadow&&(r()?(e=v.wrapper.find(".swiper-cube-shadow"),0===e.length&&(e=a('<div class="swiper-cube-shadow"></div>'),v.wrapper.append(e)),e.css({height:v.width+"px"})):(e=v.container.find(".swiper-cube-shadow"),0===e.length&&(e=a('<div class="swiper-cube-shadow"></div>'),v.container.append(e))));for(var s=0;s<v.slides.length;s++){var i=v.slides.eq(s),n=90*s,o=Math.floor(n/360);v.rtl&&(n=-n,o=Math.floor(-n/360));var l=Math.max(Math.min(i[0].progress,1),-1),p=0,d=0,u=0;s%4===0?(p=4*-o*v.size,u=0):(s-1)%4===0?(p=0,u=4*-o*v.size):(s-2)%4===0?(p=v.size+4*o*v.size,u=v.size):(s-3)%4===0&&(p=-v.size,u=3*v.size+4*v.size*o),v.rtl&&(p=-p),r()||(d=p,p=0);var c="rotateX("+(r()?0:-n)+"deg) rotateY("+(r()?n:0)+"deg) translate3d("+p+"px, "+d+"px, "+u+"px)";if(1>=l&&l>-1&&(t=90*s+90*l,v.rtl&&(t=90*-s-90*l)),i.transform(c),v.params.cube.slideShadows){var m=i.find(r()?".swiper-slide-shadow-left":".swiper-slide-shadow-top"),f=i.find(r()?".swiper-slide-shadow-right":".swiper-slide-shadow-bottom");0===m.length&&(m=a('<div class="swiper-slide-shadow-'+(r()?"left":"top")+'"></div>'),i.append(m)),0===f.length&&(f=a('<div class="swiper-slide-shadow-'+(r()?"right":"bottom")+'"></div>'),i.append(f));{i[0].progress}m.length&&(m[0].style.opacity=-i[0].progress),f.length&&(f[0].style.opacity=i[0].progress)}}if(v.wrapper.css({"-webkit-transform-origin":"50% 50% -"+v.size/2+"px","-moz-transform-origin":"50% 50% -"+v.size/2+"px","-ms-transform-origin":"50% 50% -"+v.size/2+"px","transform-origin":"50% 50% -"+v.size/2+"px"}),v.params.cube.shadow)if(r())e.transform("translate3d(0px, "+(v.width/2+v.params.cube.shadowOffset)+"px, "+-v.width/2+"px) rotateX(90deg) rotateZ(0deg) scale("+v.params.cube.shadowScale+")");else{var h=Math.abs(t)-90*Math.floor(Math.abs(t)/90),g=1.5-(Math.sin(2*h*Math.PI/360)/2+Math.cos(2*h*Math.PI/360)/2),w=v.params.cube.shadowScale,y=v.params.cube.shadowScale/g,x=v.params.cube.shadowOffset;e.transform("scale3d("+w+", 1, "+y+") translate3d(0px, "+(v.height/2+x)+"px, "+-v.height/2/y+"px) rotateX(-90deg)")}var b=v.isSafari||v.isUiWebView?-v.size/2:0;v.wrapper.transform("translate3d(0px,0,"+b+"px) rotateX("+(r()?0:t)+"deg) rotateY("+(r()?-t:0)+"deg)")},setTransition:function(e){v.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e),v.params.cube.shadow&&!r()&&v.container.find(".swiper-cube-shadow").transition(e)}},coverflow:{setTranslate:function(){for(var e=v.translate,t=r()?-e+v.width/2:-e+v.height/2,s=r()?v.params.coverflow.rotate:-v.params.coverflow.rotate,i=v.params.coverflow.depth,n=0,o=v.slides.length;o>n;n++){var l=v.slides.eq(n),p=v.slidesSizesGrid[n],d=l[0].swiperSlideOffset,u=(t-d-p/2)/p*v.params.coverflow.modifier,c=r()?s*u:0,m=r()?0:s*u,f=-i*Math.abs(u),h=r()?0:v.params.coverflow.stretch*u,g=r()?v.params.coverflow.stretch*u:0;Math.abs(g)<.001&&(g=0),Math.abs(h)<.001&&(h=0),Math.abs(f)<.001&&(f=0),Math.abs(c)<.001&&(c=0),Math.abs(m)<.001&&(m=0);var w="translate3d("+g+"px,"+h+"px,"+f+"px)  rotateX("+m+"deg) rotateY("+c+"deg)";if(l.transform(w),l[0].style.zIndex=-Math.abs(Math.round(u))+1,v.params.coverflow.slideShadows){var y=l.find(r()?".swiper-slide-shadow-left":".swiper-slide-shadow-top"),x=l.find(r()?".swiper-slide-shadow-right":".swiper-slide-shadow-bottom");0===y.length&&(y=a('<div class="swiper-slide-shadow-'+(r()?"left":"top")+'"></div>'),l.append(y)),0===x.length&&(x=a('<div class="swiper-slide-shadow-'+(r()?"right":"bottom")+'"></div>'),l.append(x)),y.length&&(y[0].style.opacity=u>0?u:0),x.length&&(x[0].style.opacity=-u>0?-u:0)}}if(v.browser.ie){var b=v.wrapper[0].style;b.perspectiveOrigin=t+"px 50%"}},setTransition:function(e){v.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e)}}},v.lazy={initialImageLoaded:!1,loadImageInSlide:function(e,t){if("undefined"!=typeof e&&("undefined"==typeof t&&(t=!0),0!==v.slides.length)){var s=v.slides.eq(e),r=s.find(".swiper-lazy:not(.swiper-lazy-loaded):not(.swiper-lazy-loading)");!s.hasClass("swiper-lazy")||s.hasClass("swiper-lazy-loaded")||s.hasClass("swiper-lazy-loading")||r.add(s[0]),0!==r.length&&r.each(function(){var e=a(this);e.addClass("swiper-lazy-loading");var r=e.attr("data-background"),i=e.attr("data-src");v.loadImage(e[0],i||r,!1,function(){if(r?(e.css("background-image","url("+r+")"),e.removeAttr("data-background")):(e.attr("src",i),e.removeAttr("data-src")),e.addClass("swiper-lazy-loaded").removeClass("swiper-lazy-loading"),s.find(".swiper-lazy-preloader, .preloader").remove(),v.params.loop&&t){var a=s.attr("data-swiper-slide-index");if(s.hasClass(v.params.slideDuplicateClass)){var n=v.wrapper.children('[data-swiper-slide-index="'+a+'"]:not(.'+v.params.slideDuplicateClass+")");v.lazy.loadImageInSlide(n.index(),!1)}else{var o=v.wrapper.children("."+v.params.slideDuplicateClass+'[data-swiper-slide-index="'+a+'"]');v.lazy.loadImageInSlide(o.index(),!1)}}v.emit("onLazyImageReady",v,s[0],e[0])}),v.emit("onLazyImageLoad",v,s[0],e[0])})}},load:function(){var e;if(v.params.watchSlidesVisibility)v.wrapper.children("."+v.params.slideVisibleClass).each(function(){v.lazy.loadImageInSlide(a(this).index())});else if(v.params.slidesPerView>1)for(e=v.activeIndex;e<v.activeIndex+v.params.slidesPerView;e++)v.slides[e]&&v.lazy.loadImageInSlide(e);else v.lazy.loadImageInSlide(v.activeIndex);if(v.params.lazyLoadingInPrevNext)if(v.params.slidesPerView>1){for(e=v.activeIndex+v.params.slidesPerView;e<v.activeIndex+v.params.slidesPerView+v.params.slidesPerView;e++)v.slides[e]&&v.lazy.loadImageInSlide(e);for(e=v.activeIndex-v.params.slidesPerView;e<v.activeIndex;e++)v.slides[e]&&v.lazy.loadImageInSlide(e)}else{var t=v.wrapper.children("."+v.params.slideNextClass);t.length>0&&v.lazy.loadImageInSlide(t.index());var s=v.wrapper.children("."+v.params.slidePrevClass);s.length>0&&v.lazy.loadImageInSlide(s.index())}},onTransitionStart:function(){v.params.lazyLoading&&(v.params.lazyLoadingOnTransitionStart||!v.params.lazyLoadingOnTransitionStart&&!v.lazy.initialImageLoaded)&&v.lazy.load()},onTransitionEnd:function(){v.params.lazyLoading&&!v.params.lazyLoadingOnTransitionStart&&v.lazy.load()}},v.scrollbar={set:function(){if(v.params.scrollbar){var e=v.scrollbar;e.track=a(v.params.scrollbar),e.drag=e.track.find(".swiper-scrollbar-drag"),0===e.drag.length&&(e.drag=a('<div class="swiper-scrollbar-drag"></div>'),e.track.append(e.drag)),e.drag[0].style.width="",e.drag[0].style.height="",e.trackSize=r()?e.track[0].offsetWidth:e.track[0].offsetHeight,e.divider=v.size/v.virtualSize,e.moveDivider=e.divider*(e.trackSize/v.size),e.dragSize=e.trackSize*e.divider,r()?e.drag[0].style.width=e.dragSize+"px":e.drag[0].style.height=e.dragSize+"px",e.track[0].style.display=e.divider>=1?"none":"",v.params.scrollbarHide&&(e.track[0].style.opacity=0)}},setTranslate:function(){if(v.params.scrollbar){var e,a=v.scrollbar,t=(v.translate||0,a.dragSize);e=(a.trackSize-a.dragSize)*v.progress,v.rtl&&r()?(e=-e,e>0?(t=a.dragSize-e,e=0):-e+a.dragSize>a.trackSize&&(t=a.trackSize+e)):0>e?(t=a.dragSize+e,e=0):e+a.dragSize>a.trackSize&&(t=a.trackSize-e),r()?(a.drag.transform(v.support.transforms3d?"translate3d("+e+"px, 0, 0)":"translateX("+e+"px)"),a.drag[0].style.width=t+"px"):(a.drag.transform(v.support.transforms3d?"translate3d(0px, "+e+"px, 0)":"translateY("+e+"px)"),a.drag[0].style.height=t+"px"),v.params.scrollbarHide&&(clearTimeout(a.timeout),a.track[0].style.opacity=1,a.timeout=setTimeout(function(){a.track[0].style.opacity=0,a.track.transition(400)},1e3))}},setTransition:function(e){v.params.scrollbar&&v.scrollbar.drag.transition(e)}},v.controller={LinearSpline:function(e,a){this.x=e,this.y=a,this.lastIndex=e.length-1;{var t,s;this.x.length}this.interpolate=function(e){return e?(s=r(this.x,e),t=s-1,(e-this.x[t])*(this.y[s]-this.y[t])/(this.x[s]-this.x[t])+this.y[t]):0};var r=function(){var e,a,t;return function(s,r){for(a=-1,e=s.length;e-a>1;)s[t=e+a>>1]<=r?a=t:e=t;return e}}()},getInterpolateFunction:function(e){v.controller.spline||(v.controller.spline=v.params.loop?new v.controller.LinearSpline(v.slidesGrid,e.slidesGrid):new v.controller.LinearSpline(v.snapGrid,e.snapGrid))},setTranslate:function(e,a){function s(a){e=a.rtl&&"horizontal"===a.params.direction?-v.translate:v.translate,"slide"===v.params.controlBy&&(v.controller.getInterpolateFunction(a),i=-v.controller.spline.interpolate(-e)),i&&"container"!==v.params.controlBy||(r=(a.maxTranslate()-a.minTranslate())/(v.maxTranslate()-v.minTranslate()),i=(e-v.minTranslate())*r+a.minTranslate()),v.params.controlInverse&&(i=a.maxTranslate()-i),a.updateProgress(i),a.setWrapperTranslate(i,!1,v),a.updateActiveIndex()}var r,i,n=v.params.control;if(v.isArray(n))for(var o=0;o<n.length;o++)n[o]!==a&&n[o]instanceof t&&s(n[o]);else n instanceof t&&a!==n&&s(n)},setTransition:function(e,a){function s(a){a.setWrapperTransition(e,v),0!==e&&(a.onTransitionStart(),a.wrapper.transitionEnd(function(){i&&(a.params.loop&&"slide"===v.params.controlBy&&a.fixLoop(),a.onTransitionEnd())}))}var r,i=v.params.control;if(v.isArray(i))for(r=0;r<i.length;r++)i[r]!==a&&i[r]instanceof t&&s(i[r]);else i instanceof t&&a!==i&&s(i)}},v.hashnav={init:function(){if(v.params.hashnav){v.hashnav.initialized=!0;var e=document.location.hash.replace("#","");if(e)for(var a=0,t=0,s=v.slides.length;s>t;t++){var r=v.slides.eq(t),i=r.attr("data-hash");if(i===e&&!r.hasClass(v.params.slideDuplicateClass)){var n=r.index();v.slideTo(n,a,v.params.runCallbacksOnInit,!0)}}}},setHash:function(){v.hashnav.initialized&&v.params.hashnav&&(document.location.hash=v.slides.eq(v.activeIndex).attr("data-hash")||"")}},v.disableKeyboardControl=function(){a(document).off("keydown",p)},v.enableKeyboardControl=function(){a(document).on("keydown",p)},v.mousewheel={event:!1,lastScrollTime:(new window.Date).getTime()},v.params.mousewheelControl){try{new window.WheelEvent("wheel"),v.mousewheel.event="wheel"}catch(L){}v.mousewheel.event||void 0===document.onmousewheel||(v.mousewheel.event="mousewheel"),v.mousewheel.event||(v.mousewheel.event="DOMMouseScroll")}v.disableMousewheelControl=function(){return v.mousewheel.event?(v.container.off(v.mousewheel.event,d),!0):!1},v.enableMousewheelControl=function(){return v.mousewheel.event?(v.container.on(v.mousewheel.event,d),!0):!1},v.parallax={setTranslate:function(){v.container.children("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function(){u(this,v.progress)}),v.slides.each(function(){var e=a(this);e.find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function(){var a=Math.min(Math.max(e[0].progress,-1),1);u(this,a)})})},setTransition:function(e){"undefined"==typeof e&&(e=v.params.speed),v.container.find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y]").each(function(){var t=a(this),s=parseInt(t.attr("data-swiper-parallax-duration"),10)||e;0===e&&(s=0),t.transition(s)})}},v._plugins=[];for(var B in v.plugins){var O=v.plugins[B](v,v.params[B]);O&&v._plugins.push(O)}return v.callPlugins=function(e){for(var a=0;a<v._plugins.length;a++)e in v._plugins[a]&&v._plugins[a][e](arguments[1],arguments[2],arguments[3],arguments[4],arguments[5])},v.emitterEventListeners={},v.emit=function(e){v.params[e]&&v.params[e](arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);var a;if(v.emitterEventListeners[e])for(a=0;a<v.emitterEventListeners[e].length;a++)v.emitterEventListeners[e][a](arguments[1],arguments[2],arguments[3],arguments[4],arguments[5]);v.callPlugins&&v.callPlugins(e,arguments[1],arguments[2],arguments[3],arguments[4],arguments[5])},v.on=function(e,a){return e=c(e),v.emitterEventListeners[e]||(v.emitterEventListeners[e]=[]),v.emitterEventListeners[e].push(a),v},v.off=function(e,a){var t;if(e=c(e),"undefined"==typeof a)return v.emitterEventListeners[e]=[],v;if(v.emitterEventListeners[e]&&0!==v.emitterEventListeners[e].length){for(t=0;t<v.emitterEventListeners[e].length;t++)v.emitterEventListeners[e][t]===a&&v.emitterEventListeners[e].splice(t,1);return v}},v.once=function(e,a){e=c(e);var t=function(){a(arguments[0],arguments[1],arguments[2],arguments[3],arguments[4]),v.off(e,t)};return v.on(e,t),v},v.a11y={makeFocusable:function(e){return e.attr("tabIndex","0"),e},addRole:function(e,a){return e.attr("role",a),e},addLabel:function(e,a){return e.attr("aria-label",a),e},disable:function(e){return e.attr("aria-disabled",!0),e},enable:function(e){return e.attr("aria-disabled",!1),e},onEnterKey:function(e){13===e.keyCode&&(a(e.target).is(v.params.nextButton)?(v.onClickNext(e),v.a11y.notify(v.isEnd?v.params.lastSlideMessage:v.params.nextSlideMessage)):a(e.target).is(v.params.prevButton)&&(v.onClickPrev(e),v.a11y.notify(v.isBeginning?v.params.firstSlideMessage:v.params.prevSlideMessage)),a(e.target).is("."+v.params.bulletClass)&&a(e.target)[0].click())},liveRegion:a('<span class="swiper-notification" aria-live="assertive" aria-atomic="true"></span>'),notify:function(e){var a=v.a11y.liveRegion;0!==a.length&&(a.html(""),a.html(e))},init:function(){if(v.params.nextButton){var e=a(v.params.nextButton);v.a11y.makeFocusable(e),v.a11y.addRole(e,"button"),v.a11y.addLabel(e,v.params.nextSlideMessage)}if(v.params.prevButton){var t=a(v.params.prevButton);v.a11y.makeFocusable(t),v.a11y.addRole(t,"button"),v.a11y.addLabel(t,v.params.prevSlideMessage)}a(v.container).append(v.a11y.liveRegion)},initPagination:function(){v.params.pagination&&v.params.paginationClickable&&v.bullets&&v.bullets.length&&v.bullets.each(function(){var e=a(this);v.a11y.makeFocusable(e),v.a11y.addRole(e,"button"),v.a11y.addLabel(e,v.params.paginationBulletMessage.replace(/{{index}}/,e.index()+1))})},destroy:function(){v.a11y.liveRegion&&v.a11y.liveRegion.length>0&&v.a11y.liveRegion.remove()}},v.init=function(){v.params.loop&&v.createLoop(),v.updateContainerSize(),v.updateSlidesSize(),v.updatePagination(),v.params.scrollbar&&v.scrollbar&&v.scrollbar.set(),"slide"!==v.params.effect&&v.effects[v.params.effect]&&(v.params.loop||v.updateProgress(),v.effects[v.params.effect].setTranslate()),v.params.loop?v.slideTo(v.params.initialSlide+v.loopedSlides,0,v.params.runCallbacksOnInit):(v.slideTo(v.params.initialSlide,0,v.params.runCallbacksOnInit),0===v.params.initialSlide&&(v.parallax&&v.params.parallax&&v.parallax.setTranslate(),v.lazy&&v.params.lazyLoading&&(v.lazy.load(),v.lazy.initialImageLoaded=!0))),v.attachEvents(),v.params.observer&&v.support.observer&&v.initObservers(),v.params.preloadImages&&!v.params.lazyLoading&&v.preloadImages(),v.params.autoplay&&v.startAutoplay(),v.params.keyboardControl&&v.enableKeyboardControl&&v.enableKeyboardControl(),v.params.mousewheelControl&&v.enableMousewheelControl&&v.enableMousewheelControl(),v.params.hashnav&&v.hashnav&&v.hashnav.init(),v.params.a11y&&v.a11y&&v.a11y.init(),v.emit("onInit",v)},v.cleanupStyles=function(){v.container.removeClass(v.classNames.join(" ")).removeAttr("style"),v.wrapper.removeAttr("style"),v.slides&&v.slides.length&&v.slides.removeClass([v.params.slideVisibleClass,v.params.slideActiveClass,v.params.slideNextClass,v.params.slidePrevClass].join(" ")).removeAttr("style").removeAttr("data-swiper-column").removeAttr("data-swiper-row"),v.paginationContainer&&v.paginationContainer.length&&v.paginationContainer.removeClass(v.params.paginationHiddenClass),v.bullets&&v.bullets.length&&v.bullets.removeClass(v.params.bulletActiveClass),v.params.prevButton&&a(v.params.prevButton).removeClass(v.params.buttonDisabledClass),v.params.nextButton&&a(v.params.nextButton).removeClass(v.params.buttonDisabledClass),v.params.scrollbar&&v.scrollbar&&(v.scrollbar.track&&v.scrollbar.track.length&&v.scrollbar.track.removeAttr("style"),v.scrollbar.drag&&v.scrollbar.drag.length&&v.scrollbar.drag.removeAttr("style"))},v.destroy=function(e,a){v.detachEvents(),v.stopAutoplay(),v.params.loop&&v.destroyLoop(),a&&v.cleanupStyles(),v.disconnectObservers(),v.params.keyboardControl&&v.disableKeyboardControl&&v.disableKeyboardControl(),v.params.mousewheelControl&&v.disableMousewheelControl&&v.disableMousewheelControl(),v.params.a11y&&v.a11y&&v.a11y.destroy(),v.emit("onDestroy"),e!==!1&&(v=null)},v.init(),v}};t.prototype={isSafari:function(){var e=navigator.userAgent.toLowerCase();return e.indexOf("safari")>=0&&e.indexOf("chrome")<0&&e.indexOf("android")<0}(),isUiWebView:/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(navigator.userAgent),isArray:function(e){return"[object Array]"===Object.prototype.toString.apply(e)},browser:{ie:window.navigator.pointerEnabled||window.navigator.msPointerEnabled,ieTouch:window.navigator.msPointerEnabled&&window.navigator.msMaxTouchPoints>1||window.navigator.pointerEnabled&&window.navigator.maxTouchPoints>1},device:function(){var e=navigator.userAgent,a=e.match(/(Android);?[\s\/]+([\d.]+)?/),t=e.match(/(iPad).*OS\s([\d_]+)/),s=e.match(/(iPod)(.*OS\s([\d_]+))?/),r=!t&&e.match(/(iPhone\sOS)\s([\d_]+)/);return{ios:t||r||s,android:a}}(),support:{touch:window.Modernizr&&Modernizr.touch===!0||function(){return!!("ontouchstart"in window||window.DocumentTouch&&document instanceof DocumentTouch)}(),transforms3d:window.Modernizr&&Modernizr.csstransforms3d===!0||function(){var e=document.createElement("div").style;return"webkitPerspective"in e||"MozPerspective"in e||"OPerspective"in e||"MsPerspective"in e||"perspective"in e}(),flexbox:function(){for(var e=document.createElement("div").style,a="alignItems webkitAlignItems webkitBoxAlign msFlexAlign mozBoxAlign webkitFlexDirection msFlexDirection mozBoxDirection mozBoxOrient webkitBoxDirection webkitBoxOrient".split(" "),t=0;t<a.length;t++)if(a[t]in e)return!0}(),observer:function(){return"MutationObserver"in window||"WebkitMutationObserver"in window}()},plugins:{}};for(var s=["jQuery","Zepto","Dom7"],r=0;r<s.length;r++)window[s[r]]&&e(window[s[r]]);var i;i="undefined"==typeof Dom7?window.Dom7||window.Zepto||window.jQuery:Dom7,i&&("transitionEnd"in i.fn||(i.fn.transitionEnd=function(e){function a(i){if(i.target===this)for(e.call(this,i),t=0;t<s.length;t++)r.off(s[t],a)}var t,s=["webkitTransitionEnd","transitionend","oTransitionEnd","MSTransitionEnd","msTransitionEnd"],r=this;if(e)for(t=0;t<s.length;t++)r.on(s[t],a);return this}),"transform"in i.fn||(i.fn.transform=function(e){for(var a=0;a<this.length;a++){var t=this[a].style;t.webkitTransform=t.MsTransform=t.msTransform=t.MozTransform=t.OTransform=t.transform=e}return this}),"transition"in i.fn||(i.fn.transition=function(e){"string"!=typeof e&&(e+="ms");for(var a=0;a<this.length;a++){var t=this[a].style;t.webkitTransitionDuration=t.MsTransitionDuration=t.msTransitionDuration=t.MozTransitionDuration=t.OTransitionDuration=t.transitionDuration=e}return this})),window.Swiper=t}(),"undefined"!=typeof module?module.exports=window.Swiper:"function"==typeof define&&define.amd&&define('entry/js/lib/swiper.js',[],function(){"use strict";return window.Swiper});
//# sourceMappingURL=maps/swiper.jquery.min.js.map;
define('entry/js/core/core',['../lib/zepto', './tools','../lib/avalon.modern.shim','../lib/swiper.js'], function(zepto, tools, avalon) {
	// return $;
	var core = {};
	core.Tools = tools;
	// core.Swiper = swiper;
	core.onrender = function(id, callback) {
		var dom = $('.page');
		if(dom.attr("data-render-id") === id) {
			callback(dom);
		}
	};
	return core;
});
define('entry/js/src/jump',[],function() {
	var baseUrl = "http://www.s-jz.com/pub/Sbuild/"
		, redirect = encodeURIComponent(baseUrl + "html/redirect.html")
		, jumpurl = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=" + redirect + "&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect"
		, shopChartUrl = baseUrl + "html/payment/"
		, checkUsr = {};

	checkUsr.doJump = function() {
		window.location.href = jumpurl;
	};
	checkUsr.toShopChart = function() {
		window.location.href = shopChartUrl;
	};
	checkUsr.toIndex = function() {
		window.location.href = baseUrl + "html/user/";
	};
	checkUsr.toUserInfo = function() {
		window.location.href = baseUrl + "html/ucenter/uinfo.html";
	};
	return checkUsr;
});
define('entry/js/src/component/dialog',['../../core/core'], function(core) {
	var isfirst = true;
	var allData = [];
	var dialog = {
		TEMPLATE: '<div class="dialog-mask"></div><div class="dialog-body"><p></p><a class="button-ok">确定</a></div>',
		add: function(txt) {
			console.log("Enter dialog Component!");
			var _this = this;
			_this.beforeShow(txt);
		},
		beforeShow: function(txt) {
			var _this = this;
			var dialog;
			if (!$('.dialog-mask').length) {
				dialog = $(_this.TEMPLATE);
				isfirst = true;
			} else {
				dialog = $('.dialog-mask, .dialog-body');
				isfirst = false;
			}
			dialog.find('p').html(txt);
			if (isfirst) {
				$('body').append(dialog);
				setTimeout(function() {
					_this.show($('.dialog-body'), _this);
				}, 100);
			} else {
				$('.dialog-body, .dialog-mask').show();
				_this.show($('.dialog-body'), _this);
			}
		},

		show: function(el, _this) {
			var elH = $(el).height();
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0) translateY(-" + elH + "px);");
			_this.hideBind(el);
		},
		hide: function(el) {
			// $(el).removeClass("anim");
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0);");
			$('.dialog-mask').hide();
			this.afterHide();
		},
		hideBind: function(el) {
			var _this = this;
			$('.dialog-mask, .button-ok').off('click').on('click', function() {
				_this.hide(el);
			});
		},
		afterHide: function() {
			setTimeout(function() {
				$('.dialog-body').hide();
			}, 300);
		}
	};

	return dialog;
});
define('entry/js/src/order',['../core/core', './jump', './component/dialog'], function(core, checkUsr, dialog) {
	var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
	var OrderConfig = {};
	// 下订单
	OrderConfig.addOrderAjax = function(productId, params) {
		$.ajax({
			url: baseUrl + "orderCtrl/addOrder.htm",
			data: {"ordersStr": '{"orders": [{"productId":' + productId + ', ' + params + '}]}'},
			dataType: "json",
			success: function(res) {
				var code = res.ret;
				// 未登录
				if (code == 302) {
					// 请求微信授权接口wxf25cf835f9d71720
					// window.location.href="https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx4d6a2dce4f09dfd0&redirect_uri=http%3A%2F%2Fwww.s-jz.com%2Fhtml%2Fuser&response_type=code&scope=snsapi_userinfo&state=STATE&connect_redirect=1#wechat_redirect";
					// window.location.href = jumpurl;
					checkUsr.doJump();
					// wxAuth();
				} else if (code == 1) {
					// 已登录 进入购物车
					checkUsr.toShopChart();
				} else if (code == -1) {
					// 登录失败。提示重试
					alert("登录失败！");
				}
			},
			error: function(res) {
				alert(JSON.stringify(res));
			}
		});
	};
	OrderConfig.addToShopChart = function(productId, params) {
		$.ajax({
			url: baseUrl + "orderCtrl/addOrder.htm",
			data: {"ordersStr": '{"orders": [{"productId":' + productId + ', ' + params + '}]}'},
			dataType: "json",
			success: function(res) {
				// alert(JSON.stringify(res));
				var code = res.ret;
				// 未登录
				if (code == 302) {
					// window.location.href = jumpurl;
					checkUsr.doJump();
					// wxAuth();
				} else if (code == 1) {
					// 已登录 提示加入购物车成功
					dialog.add("已成功加入购物车！");
				} else if (code == -1) {
					// 登录失败。提示重试
					alert("登录失败！");
				}
			}
		});
	};

	return OrderConfig;
});
define('entry/js/src/usernewyingzhuang.js',['../core/core', '../src/order'], function(core, OrderConfig) {
	core.onrender("user-new-yingzhuang", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var productStyle = "艺术学院";
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;
		var s6h = $('.user-index-html .swiper-slide-yingzhuang-sev .pics').width();
		$('.swiper-slide-yingzhuang-sev .yz-six').css("height", s6h * 0.38 + "px");
		$('.swiper-slide-yingzhuang-sev .yz-svn').css("height", s6h * 0.55 + "px");
		if (isAndroid) {
			var h1 = Tools.calcSepHeight(96, 2);
			var w1 = Tools.calcSepHeight(6, 2, "h");
			var h2 = Tools.calcSepHeight(155, 1, "a");
			console.log(h1,w1,h2);
			$('.yingzhuang-li-comm .list .lrow', dom).css("height", h1 + "px");
			$('.yingzhuang-li-comm .list .lcol', dom).css("width", w1 + "px");
			$('.swiper-slide-yingzhuang-six .container', dom).css("height", h2 + "px");

			var h3 = Tools.calcSepHeight(0, 7, "a", $('.swiper-slide-yingzhuang-six .container', dom));
			$('.swiper-slide-yingzhuang-six .container .row', dom).css("heiht", h3 + "px");

			$('html').removeClass("ios").addClass("android");
		} else {
			$('html').removeClass("android").addClass("ios");
		}
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v1',{
			pagination: '.swiper-pagination-h1',
			direction: 'vertical',
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// 延迟加载
				var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
				[].forEach.call(imgs, function(img) {
					var src = $(img).attr("data-src");
					if (src) {
						$(img).attr("src", src);
						$(img).removeAttr("data-src");
					}
				});
			}
		});

		// style
		var styleLis = $('.user-choose-list ul li', dom);
		styleLis.off('click').on('click', function() {
			$(this).addClass("on").siblings().removeClass("on");
			productStyle = $(this).find('span').html();
		});

		$('.order', dom).off('click').on('click', function() {
			var params = '"acreage":100,"balconyNum":1,"toiletNum":1,"productStyle":"' + productStyle + '"';
    		OrderConfig.addOrderAjax(2, params);
		});
		$('.shopcart', dom).off('click').on('click', function() {
			var params = '"acreage":100,"balconyNum":1,"toiletNum":1,"productStyle":"' + productStyle + '"';
    		OrderConfig.addToShopChart(2, params);
		});
	});
});
define('entry/js/src/usernewruanzhuang.js',['../core/core', '../src/order'], function(core, OrderConfig) {
	core.onrender("user-new-ruanzhuang", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);

		var lazyLoad = function(imgs) {
			[].forEach.call(imgs, function(img) {
				var src = $(img).attr("data-src");
				if (src) {
					$(img).attr("src", src);
					$(img).removeAttr("data-src");
				}
			});
		};
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var Tools = core.Tools;
		if (isQQUC) {
			var h = Tools.calcSepHeight(0, 3);
			$('.ruanzhuang-show-comm .content .col', dom).css("height", h + "px");
		}
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v2',{
			pagination: '.swiper-pagination-h2',
			direction: 'vertical',
			onInit: function(swiper){
		    	var index = swiper.activeIndex;
		    	var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
		    	lazyLoad(imgs);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				console.log(index);
				// 延迟加载
				var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
				lazyLoad(imgs);
			}
		});
		// style
		var productStyle = "艺术学院";
		var styleLis = $('.user-choose-list ul li', dom);
		styleLis.off('click').on('click', function() {
			$(this).addClass("on").siblings().removeClass("on");
			productStyle = $(this).find('span').html();
		});
		// 下单
		var layout = 1;
		$('.order', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addOrderAjax(3, params);
		});
		$('.shopcart', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addToShopChart(3, params);
		});
	});
});
define('entry/js/src/usernewjiaju.js',['../core/core', '../src/order'], function(core, OrderConfig) {
	core.onrender("user-new-jiaju", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var lazyLoad = function(imgs) {
			[].forEach.call(imgs, function(img) {
				var src = $(img).attr("data-src");
				if (src) {
					$(img).attr("src", src);
					$(img).removeAttr("data-src");
				}
			});
		};
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;
		if (isAndroid) {
			var h = Tools.calcSepHeight(0, 3);
			$('.ruanzhuang-show-comm .content .col', dom).css("height", h + "px");
			$('.swiper-slide-jiaju-three .item-show', dom)
			.css(
				"marginLeft", 
				$('.swiper-slide-jiaju-three .content').width() - 114 + "px"
			);
		}
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v3',{
			pagination: '.swiper-pagination-h3',
			direction: 'vertical',
			onInit: function(swiper){
		    	var index = swiper.activeIndex;
		    	var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
		    	lazyLoad(imgs);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				console.log(index);
				// 延迟加载
				var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
				lazyLoad(imgs);
			}
		});
		// style
		var productStyle = "艺术学院";
		var styleLis = $('.user-choose-list ul li', dom);
		styleLis.off('click').on('click', function() {
			$(this).addClass("on").siblings().removeClass("on");
			productStyle = $(this).find('span').html();
		});
		// 下单
		var layout = 1;
		$('.order', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addOrderAjax(4, params);
		});
		$('.shopcart', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addToShopChart(4, params);
		});
	});
});
define('entry/js/src/usernewjiadian.js',['../core/core', '../src/order'], function(core, OrderConfig) {
	core.onrender("user-new-jiadian", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;

		if (isAndroid) {
			var h = Tools.calcSepHeight(0, 3);
			$('.ruanzhuang-show-comm .content .col', dom).css("height", h + "px");
			$('.swiper-slide-jiadian-two .item-show', dom)
			.css(
				"marginLeft", 
				$('.swiper-slide-jiadian-two .bg-content').width() - 114 + "px"
			);
		}
		var lazyLoad = function(imgs) {
			[].forEach.call(imgs, function(img) {
				var src = $(img).attr("data-src");
				if (src) {
					$(img).attr("src", src);
					$(img).removeAttr("data-src");
				}
			});
		};
		var sliders = $('.swiper-slide', dom);
		var mySwiper2 = new Swiper('.swiper-container-v4',{
			pagination: '.swiper-pagination-h4',
			direction: 'vertical',
			onInit: function(swiper){
		    	var index = swiper.activeIndex;
		    	var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
		    	lazyLoad(imgs);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				console.log(index);
				// 延迟加载
				var imgs = $('img', $(sliders[index])).concat($('img', $(sliders[index + 1])));
				lazyLoad(imgs);
			}
		});
		// style
		var productStyle = "艺术学院";
		var styleLis = $('.user-choose-list ul li', dom);
		styleLis.off('click').on('click', function() {
			$(this).addClass("on").siblings().removeClass("on");
			productStyle = $(this).find('span').html();
		});
		// 下单
		var layout = 1;
		$('.order', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addOrderAjax(5, params);
		});
		$('.shopcart', dom).off('click').on('click', function() {
			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		OrderConfig.addToShopChart(5, params);
		});
	});
});
define('entry/js/src/kfuserindex.js',['../core/core'], function(core) {
	core.onrender("kf-userindex", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var isQQUC = /(ucbrowser)|(mqqbrowser)/.test(navigator.userAgent.toLowerCase());
		var u = navigator.userAgent;
		var isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1; //android终端或者uc浏览器
		var Tools = core.Tools;
		if (isAndroid) {
			var h = Tools.calcSepHeight(68, 4);
			$('.page-two .style', dom).css("height", h + "px");
		}
		var mySwiper1 = new Swiper('.swiper-container',{
			direction: 'vertical'
		});
	});
});
define('entry/js/src/kfstylenav.js',['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("kf-style", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var kftype = location.hash.replace(/#!_/,"") || "art";
		var productStyle = "";
		var Tools = core.Tools;
		var imgs = $('img', $('.swiper-container'));
		var items = $('.choose-style .items span', dom);
		var itemsTxt = $('.choose-style .items-intro', dom);
		var itemsPrice = $('.choose-style .price', dom);
		var swipcnt = $('.swiper-container', dom);
		var layout = 1;
		var nums = null;
		var mySwiper1 = new Swiper('.swiper-container',{
			// direction: 'vertical'
			pagination: '.pagination-style',
			autoplay: 3000,
			onInit: function(swiper){
		    	console.log("init");
		    	var width = parseInt(Tools.getCurrentStyle(swipcnt[0], "width"));
		    	var height = width * 0.6875;
		    	swipcnt.css("height", height + "px");
		    	Tools.lazyLoad([imgs[0], imgs[1]]);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// 延迟加载
				Tools.lazyLoad(imgs[index + 1]);
			}
		});

		var kfvm = avalon.define({
			$id: "root",
			price: 3600,
			txt: "一室一厅"
		});
		avalon.scan();

		switch(kftype) {
			case "art": 
				productStyle = "艺术学院";
				break;
			case "mag": 
				productStyle = "魔法学院";
				break;
			case "nav": 
				productStyle = "海军学院";
				break;
			case "cau": 
				productStyle = "人文学院";
				break;
		}

		$(items).off('click').on('click', function() {
			var index = $(this).index();
			$(this).addClass("on").siblings().removeClass("on");
			var txt = "";
			var price = 0;
			switch(index) {
				case 0: 
					txt = "一室一厅";
					price = 3600;
					layout = 1;
					nums = null;
					break;
				case 1: 
					txt = "二室一厅";
					price = 5499;
					layout = 2;
					nums = null;
					break;
				case 2: 
					txt = "三室一厅";
					price = 7399;
					layout = 3;
					nums = null;
					break;
				case 3: 
					txt = "一个卧室";
					price = 1999;
					layout = null;
					nums = 1;
					break;
			}
			// itemsTxt.html(txt);
			// itemsPrice.html(price);
			kfvm.price = price;
			kfvm.txt = txt;
		});
		var imgLists = $('img', '.pic-lists');
    	Tools.lazyLoad(imgLists);

    	$('.ordernow').off('click').on('click', function() {
    		var location = window.location.href;
    		var params = "";
    		if (!!nums) {
    			params = '"nums": 1,"productStyle":"' + productStyle + '"';
    		} else {
    			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		}
    		OrderConfig.addOrderAjax(1, params);
    		// $.ajax({
    		// 	url:  baseUrl + "orderCtrl/addOrder.htm",
    		// 	data: {"ordersStr": '{"orders": [{"productId": 1, ' + params + '}]}'},
    		// 	dataType: "json",
    		// 	success: function(res) {
    		// 		var code = res.ret;
    		// 		// 未登录
    		// 		if (code == 302) {
    		// 			checkUsr.doJump();
    		// 		} else if (code == 1) {
    		// 			// 已登录 进入购物车
    		// 			checkUsr.toShopChart();
    		// 		} else if (code == -1) {
    		// 			// 登录失败。提示重试
    		// 			alert("登录失败！");
    		// 		}
    		// 	}
    		// });
    	});
    	$('.shopchart').off('click').on('click', function() {
    		var location = window.location.href;
    		var params = "";
    		if (!!nums) {
    			params = '"nums": 1,"productStyle":"' + productStyle + '"';
    		} else {
    			params = '"layout": ' + layout + ',"productStyle":"' + productStyle + '"';
    		}
    		OrderConfig.addToShopChart(1, params);
    	});
	});
});
define('entry/js/src/jfpart.js',['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("jf-part", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);

		var Tools = core.Tools;
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var swipcnt = $('.swiper-container', dom);
		var imgs = $('img', $('.swiper-container'));
		var chosBtns = $('.price-sec .btn', dom);
		var orderNow = $('.order', dom);
		var addChart = $('.shopcart', dom);
		var initPriceSet = { // 默认平米数set
			6: 10, // 地板默认平米数
			7: 10, // 乳胶漆
			8: 10, // 壁纸
			9: 10, // 瓷砖
			10: 10, // 厨卫天花
			11: 1 // 室内门
		};
		var selected = [6];

		Array.prototype.arrayDelItem = function(item) {
			for (var i = 0, n = this.length; i < n; i++) {
				if (this[i] === item) {
					this.splice(i, 1);
				}
			}
			return this;
		};

		var mySwiper1 = new Swiper('.swiper-container',{
			// direction: 'vertical'
			pagination: '.pagination-style',
			autoplay: 3000,
			onInit: function(swiper){
		    	var width = parseInt(Tools.getCurrentStyle(swipcnt[0], "width"));
		    	var height = width * 0.74375;
		    	swipcnt.css("height", height + "px");
		    	Tools.lazyLoad([imgs[0], imgs[1]]);
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// 延迟加载
				Tools.lazyLoad(imgs[index + 1]);
			}
		});
		chosBtns.off('click').on('click', function() {
			var proid = parseInt($(this).attr("data-proid"));
			if ($(this).hasClass("on")) {
				$(this).removeClass("on");
				selected = selected.arrayDelItem(proid);
			} else {
				$(this).addClass("on");
				selected.push(proid);
			}
		});
		// data: {"ordersStr": '{"orders": [{"productId":' + productId + ', ' + params + '}]}'},
		
		// 下单
		$('.shopcart, .order').off('click').on('click', function() {
			var className = $(this).attr("class");
			var params = "";

			function danwei_params(id) {
				if (id !== 11) {
					return "acreage";
				} else {
					return "nums";
				}
			}
			[].forEach.call(selected, function(item, index) {
				if (index == (selected.length - 1)) {
					params += '{"productId":' + item + ', "' + danwei_params(item) + '":' + initPriceSet[item] + '}';
				} else {
					params += '{"productId":' + item + ', "' + danwei_params(item) + '":' + initPriceSet[item] + '},';
				}
			});
			var dataParam = {"ordersStr": '{"orders": [' + params + ']}'};
			console.dir();
			$.ajax({
				url: baseUrl + "orderCtrl/addOrder.htm",
				data: dataParam,
				dataType: "json",
				success: function(res) {
					// alert(JSON.stringify(res));
					var code = res.ret;
					// 未登录
					if (code == 302) {
						checkUsr.doJump();
						// wxAuth();
					} else if (code == 1) {
						if (/shopcart/.test(className)) {
							// 已登录 提示加入购物车成功
							dialog.add("已成功加入购物车！");
						} else {
							// 已登录 跳转到订单列表
							checkUsr.toShopChart();
						}
					} else if (code == -1) {
						// 登录失败。提示重试
						alert("登录失败！");
					}
				},
				error: function(res) {
					alert(JSON.stringify(res));
				}
			});
		});
	});
});
define('entry/js/src/component/slideOptions',['../../core/core'], function(core) {
	var isfirst = true;
	var isChoose = false;
	var allData = [];
	var slideOption = {
		TEMPLATE: '<div class="form-mask"></div><div class="form-slide"><header class="sli-title"><span>选项</span><em class="slide-cancel">取消</em></header><ul class="slide-item-ul"><li class="on"><span>200-300</span><i></i></li></ul></div>',
		// {
		// 	title: "这是标题这是标题",
		// 	data: ["选项一","选项二","选项三","选项四","选项五","选项六"],
		//  choose: false,
		// 	callback: function() {
		// 	}
		// }
		add: function(elem, options) {
			console.log("Enter slideOption Component!");
			var _this = this;
			isChoose = options.choose || false;
			if (options.initOption && typeof options.initOption === 'function') {
				options.initOption(elem, options.data);
			}
			$(elem).off("click").on("click", function() {
				allData = options.data;
				_this.beforeShow(elem, options);
			});
		},
		beforeShow: function(elem, options, callback) {
			var _this = this;
			var title = options.title;
			var data = options.data;
			var slide;
			if (!$('.form-mask').length) {
				slide = $(_this.TEMPLATE);
				isfirst = true;
			} else {
				slide = $('.form-mask, .form-slide');
				isfirst = false;
			}
			slide.find('.sli-title span').html(title);
			var content = [];
			[].forEach.call(data, function(item) {
				content.push('<li data-id="' + item.id + '"><span>' + item.txt + '</span><i></i></li>');
			});
			slide.find('.slide-item-ul').html(content.join(""));
			if (isfirst) {
				$('body').append(slide);
				setTimeout(function() {
					_this.show($('.form-slide'), _this, elem, options.callback);
				}, 100);
			} else {
				// _this.show($('.form-slide'), _this, elem, options.callback);
				$('.form-slide, .form-mask').show();
				_this.show($('.form-slide'), _this, elem, options.callback);
			}
		},

		show: function(el, _this, pageElem, callback) {
			var elH = $(el).height();
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0) translateY(-" + elH + "px);");
			_this.hideBind(el);
			if (isChoose) {
				_this.itemEvent(el, pageElem, callback);
			}
		},
		hide: function(el) {
			// $(el).removeClass("anim");
			$(el).attr("style", "-webkit-transform: translate3d(0,0,0);");
			$('.form-mask').hide();
			this.afterHide();
		},
		hideBind: function(el) {
			var _this = this;
			$('.form-mask, .slide-cancel').off('click').on('click', function() {
				_this.hide(el);
			});
		},
		afterHide: function() {
			setTimeout(function() {
				$('.form-slide').hide();
			}, 300);
		},
		itemEvent: function(el, pageElem, callback) {
			var _this = this;
			var lis = $('.form-slide li');
			var input = $(pageElem).find('input');
			if($(input).attr('data-id')){
				[].forEach.call(lis, function(li) {
					if ($(li).attr("data-id") === $(input).attr('data-id')) {
						$(li).addClass("on");
					}	
				});
			}

			$('.form-slide li').off('click').on('click', function() {
				var index = $(this).index();
				if(callback && typeof callback === "function") {
					callback(allData[index]);
				}
				$(this).addClass("on").siblings().removeClass("on");
				setTimeout(function() {
					_this.hide(el);
				}, 300);
				
			});
		}
		
	};

	return slideOption;
});
define('entry/js/src/shopcart.js',['../core/core', './component/slideOptions', './component/dialog', './jump', './order'], function(core, slideOption, dialog, checkUsr, OrderConfig) {
	core.onrender("shop-cart", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);

		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		if (localStorage.getItem("_prepage")) {
			localStorage.removeItem("_prepage");
		}
		var Tools = core.Tools
			, yzOrderDtl = {}
			// 初始化价格
			, priceDetail = {}
			, selectedOrder = ""
			, payState = 1
			, productType = 1
			, kfOrder = $('.kuaifan-order', dom)
			, yzOrder = $('.yingzhuang-order', dom)
			, chooseBtns = $('.choose-cbtn', dom)
			, priceEl = $('#total-price')
			, topNav = $('.order-type .type-item')
			, payButton = $('.gopay')
			, priceTxtEl = $('#price-txt');

		var stepCal = function(num) {
			if (num == 0) {
				return {txt: "即将开始", on: ""};
			} else if (num == 2) {
				return {txt: "施工中", on: ""};
			} else if (num == 3) {
				return {txt: "验收中", on: ""};
			} else if (num == 4) {
				return {txt: "失败返工", on: ""};
			} else if (num == 5) {
				return {txt: "已完工", on: "on"};
			} else if (num == 1) {
				return {txt: "支付完成", on: "on"};
			}
		};

		var rmArrayItem = function(item, array) {
			var resArr = array;
			for (var i = 0, n = array.length; i < n; i++) {
				if (item == array[i]) {
					resArr.splice(i, 1);
					break;
				}
			}
			return resArr;
		};

		var shopCart = {
			EL_orderLis: $('.order-list', dom),
			init: function() {
				var This = this;
				// 请求订单列表
				this.getOrder(1);
				// 支付事件绑定
				payButton.off('click').on('click', function() {
					// alert(selectedOrder);
					if (!!selectedOrder.length) {
						This.wxPay_qianzheng(payState, productType);
					} else {
						dialog.add("没有选择可支付的订单");
					}
				});
				// 顶部导航点击
				topNav.off('click').on('click', function() {
					var index = $(this).index();
					$(this).addClass('on').siblings().removeClass('on');
					This.getOrder(index + 1);
				});
			},
			// get price
			// _getPrice: function() {
			// 	var total = 0;
			// 	console.log("!!!!");
			// 	console.log(priceDetail);
			// 	for (var i in priceDetail) {
			// 		total += priceDetail[i];
			// 	}
			// 	priceEl.html("￥" + total);
			// },

			// 未选中订单不可选逻辑处理
			_unChooseOrder: function(orders) {
				if (typeof orders === 'object' && Object.prototype.toString.call(orders) === '[object Array]') {
					selectedOrder = [];
				} else {
					selectedOrder = rmArrayItem(orders, selectedOrder);
				}
			},
			// 硬装下拉卫生间绑定事件 initId 初始化时的数量
			_eventBindYZToiletSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择卫生间 - 硬装套餐",
					data: [
						{
							id: 1,
							txt: "一个卫生间"
						},
						{
							id: 2,
							txt: "两个卫生间"
						}
						// ,
						// {
						// 	id: 3,
						// 	txt: "三个卫生间"
						// }
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						var preSelNum = yzOrderDtl[id].toiletNum; //上一次选择的数量
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] - 3500 : priceDetail[id];
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] : priceDetail[id] + 3500;
						// 		break;
						// }
						This._ajaxModifyOrder(id, '"toiletNum":' + data.id);
						yzOrderDtl[id].toiletNum = data.id;
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			//硬装下拉阳台绑定事件
			_eventBindYZBalconySlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择阳台 - 快翻套餐",
					data: [
						{
							id: 1,
							txt: "一个阳台"
						},
						{
							id: 2,
							txt: "两个阳台"
						}
						// ,
						// {
						// 	id: 3,
						// 	txt: "三个阳台"
						// }
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						var preSelNum = yzOrderDtl[id].balconyNum; //上一次选择的数量
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] - 1000 : priceDetail[id];
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = preSelNum > 1 ? priceDetail[id] : priceDetail[id] + 1000;
						// 		break;
						// }
						This._ajaxModifyOrder(id, '"balconyNum":' + data.id);
						yzOrderDtl[id].balconyNum = data.id;
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindKFSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 快翻套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 3600
						},
						{
							id: 2,
							txt: "两居室",
							price: 6200
						},
						{
							id: 3,
							txt: "三居室",
							price: 8500
						},
						{
							id: 4,
							txt: "单间",
							price: 1999
						}
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);
						if (data.id <= 3) {
							This._ajaxModifyOrder(id, '"layout":' + data.id);
						} else {
							This._ajaxModifyOrder(id, '"nums":1');
						}
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 3600;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 6200;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 8500;
						// 		break;
						// 	case 4:
						// 		priceDetail[id] = 1999;
						// 		break;	
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindRZSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 软装套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 1300
						},
						{
							id: 2,
							txt: "两居室",
							price: 2200
						},
						{
							id: 3,
							txt: "三居室",
							price: 2900
						}
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);
						This._ajaxModifyOrder(id, '"layout":' + data.id);
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 1300;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 2200;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 2900;
						// 		break;
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindJJSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 家具套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 3000
						},
						{
							id: 2,
							txt: "两居室",
							price: 4800
						},
						{
							id: 3,
							txt: "三居室",
							price: 6500
						}
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);

						This._ajaxModifyOrder(id, '"layout":' + data.id);
						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 3000;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 4800;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 6500;
						// 		break;
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_eventBindJDSlide: function(el, id, initId) {
				var This = this;
				slideOption.add(el, {
					title: "选择居室 - 家电套餐",
					data: [
						{
							id: 1,
							txt: "一居室",
							price: 4000
						},
						{
							id: 2,
							txt: "两居室",
							price: 5500
						},
						{
							id: 3,
							txt: "三居室",
							price: 7000
						}
					],
					choose: true, // 是否是选项列表
					// 设置初始选项 不设置为null
					initOption: function(el, datas) {
						// $(el).find('input').val(datas[0].txt);
						$(el).find('input').attr("data-id", datas[0].id);
					},
					callback: function(data) {
						$(el).find('input').val(data.txt);
						$(el).find('input').attr("data-id", data.id);
						console.log(data);
						This._ajaxModifyOrder(id, '"layout":' + data.id);

						// switch(data.id) {
						// 	case 1:
						// 		priceDetail[id] = 4000;
						// 		break;
						// 	case 2:
						// 		priceDetail[id] = 5500;
						// 		break;
						// 	case 3:
						// 		priceDetail[id] = 7000;
						// 		break;
						// }
						// This._getPrice();//计算新价格并写入
						console.log(priceDetail);
					}
				});
			},
			_ajaxModifyOrder: function(oid, param) {
				$.ajax({
					url: baseUrl + "orderCtrl/updateOrders.htm",
					data: {"ordersStr": '{"orders": [{"orderId":' + parseInt(oid) + ',' + param + '}]}'}, 
					//{"ordersStr": '{"orders": [{"productId": 1, ' + params + '}]}'},
					success: function(res) {
						if (res.ret == 1) {
							// 修改成功
							var price = 0;
							var orders = res.orderInfos;
							for (var i = 0, n = orders.length; i < n; i++) {
								if (orders[i].orderId == oid) {
									price = orders[i].total;
									break;
								}
							}
							$('#price_' + oid).html(price);
							priceDetail[oid] = price;
						}
						// alert(JSON.stringify(res));
					},
					error: function(err) {
						console.log(err);
					}
				});
			},
			_ajaxCancelOrder: function(id) {
				console.log(id);
				var This = this;
				$.ajax({
					url: baseUrl + "orderCtrl/cancelOrder.htm?orderId=" + id,
					dataType: "json",
					success: function(res) {
						console.log(res);
						(res.ret == 1) && This._animationOrderHide(id);
					},
					error: function(err) {
						console.log(err);
					}
				});
			},
			_animationOrderHide: function(id) {
				console.log($('#orderCnt_' + id));
				var orderCnt = $('#orderCnt_' + id);
				var height = orderCnt.height();
				orderCnt.addClass("hide1");
				setTimeout(function() {
					// orderCnt.attr("marginTop", "-" + (height + 10) + "px");
					orderCnt.css("marginTop", -(height + 9) + "px");
					// orderCnt.css("WebkitTransform", "translateX(-640px) translateY(-" + (height + 9) + "px)");
					// orderCnt.css("height", 0);
				}, 400);
				dialog.add("已删除编号为" + id + "的订单");
				// orderCnt.css({"BorderBottom": "2px solid #d1d1d1", "opacity": 0});
			},
			getOrder: function(type) {
				var This = this;
				payState = type;
				selectedOrder = "";
				priceEl.html("￥0");
				if (type > 2) {
					$('.order-bar').hide();
				} else {
					$('.order-bar').show();
				}
				topNav.eq(type - 1).addClass('on').siblings().removeClass('on');
				$.ajax({
					// 未完成订单
					url: baseUrl + "orderCtrl/getOrders.htm?type=" + type,
					dataType: "json",
					success: function(res) {
						// alert("ret:" + JSON.stringify(res));
						var orderId = "";
						if (res.ret == 1) {
							// 获取订单信息成功
							var orderList = res.orderInfos;
							var str = "";
							// alert(typeof orderList);
							try	{
								if (!!orderList.length) {
									[].forEach.call(orderList, function(order) {
										priceDetail[order.orderId] = order.total;
										if (type != 4) {
											// ============================
											if (order.state == 0) {
												if (order.productType == 1) {
													var layout = order.layout
														, nums = order.nums
														, inputVal = ""
														, dataid = null;
													if (layout) {
														switch(layout) {
															case 1: 
																inputVal = "一居室";
																dataid = 1;
																break;
															case 2:
																inputVal = "两居室";
																dataid = 2;
																break;
															case 3:
																inputVal = "三居室";
																dataid = 3;
														}
													} else {
														inputVal = "单间";
														dataid = 4;
													}
													// 快翻订单
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 2) {
													// 硬装订单
													yzOrderDtl[order.orderId] = {};
													yzOrderDtl[order.orderId].balconyNum = order.balconyNum;
													yzOrderDtl[order.orderId].toiletNum = order.toiletNum;
													var acreage = order.acreage
														, balconyNum = order.balconyNum
														, toiletNum = order.toiletNum
														, productStyle = order.productStyle
														, balconyNumTxt = ""
														, toiletNumTxt = "";
													switch(balconyNum) {
														case 1: 
															balconyNumTxt = "一个阳台";
															break;
														case 2:
															balconyNumTxt = "两个阳台";
															break;
													}
													switch(toiletNum) {
														case 1: 
															toiletNumTxt = "一个卫生间";
															break;
														case 2:
															toiletNumTxt = "两个卫生间";
															break;
													}
													
													str += '\
														<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="yingzhuang-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose Horizontal">\
																		<div class="form-set square yz-square">\
																			<p class="item">\
																				<input type="tel" class="input-square" data-id="' + order.orderId + '" value="' + order.acreage + '平米">\
																			</p>\
																		</div>\
																		<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																		<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span>' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 3) {
													// 软装
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 4) {
													// 家具套餐
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 5) {
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType >= 6 && order.productType <= 11) {
													var proType = order.productType
														editState = order.editState
														, inputVal = ""
														, isShow = ""
														, editInfo = "系统默认"
														, dataid = null;
													switch(proType) {
														case 6: 
															inputVal = "地板";
															break;
														case 7:
															inputVal = "乳胶漆";
															break;
														case 8:
															inputVal = "壁纸";
															break;
														case 9: 
															inputVal = "瓷砖";
															break;
														case 10:
															inputVal = "厨卫天花";
															break;
														case 11:
															inputVal = "室内门";
													}
													if (editState == 0) {
														editInfo = "系统默认";
														isShow = "on";

													} else if (editState == 1) {
														editInfo = "实际面积";
														isShow = "";
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="step-list">\
																		<div class="row">\
																			<span>[' + editInfo + ']-' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																			<br/><span class="edit-info ' + isShow + '">注：具体以实际量房数据为准。</span>\
																			<span class="price">￥' + order.total + '</span>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												}
											} else if (order.state == 1) {
												// 已付99 订单进行中
												if (order.productType == 1) {
													// 快翻订单
													var layout = order.layout
														, nums = order.nums
														, inputVal = ""
														, dataid = null;
													if (layout) {
														switch(layout) {
															case 1: 
																inputVal = "一居室";
																dataid = 1;
																break;
															case 2:
																inputVal = "两居室";
																dataid = 2;
																break;
															case 3:
																inputVal = "三居室";
																dataid = 3;
														}
													} else {
														inputVal = "单间";
														dataid = 4;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-protype="kuaifan" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">快翻套餐</span>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 2) {
													var acreage = order.acreage
														, balconyNum = order.balconyNum
														, toiletNum = order.toiletNum
														, productStyle = order.productStyle
														, balconyNumTxt = ""
														, toiletNumTxt = "";
													switch(balconyNum) {
														case 1: 
															balconyNumTxt = "一个阳台";
															break;
														case 2:
															balconyNumTxt = "两个阳台";
															break;
													}
													switch(toiletNum) {
														case 1: 
															toiletNumTxt = "一个卫生间";
															break;
														case 2:
															toiletNumTxt = "两个卫生间";
															break;
													}
													var stepStr = ""
														, payStepId = "";//可以支付的stepid
													[].forEach.call(order.stepInfos, function(step) {
														(step.state == 5) && (payStepId = step.stepId);
														stepStr += '\
															<div class="row">\
																<i class="iconfont choose-cbtn ' + stepCal(step.state).on + '">&#xe60b;</i>\
																<span>' + step.stepName + stepCal(step.state).txt + '</span>\
																<span class="price">￥' + step.stepTotalCost + '</span>\
															</div>\
														';
													});
													str += '\
														<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '" data-paystep="' + payStepId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="yingzhuang-order" data-protype="yingzhuang" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">硬装套餐</span>\
																	</div>\
																	<div class="choose Horizontal">\
																		<div class="form-set square yz-square">\
																			<p class="item">\
																				<em></em>\
																				<input type="text" placeholder="' + order.acreage + '平米" readonly="readonly" data-id="1" value="100平米">\
																			</p>\
																		</div>\
																		<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																			</p>\
																		</div>\
																		<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																			</p>\
																		</div>\
																	</div>\
																	<div class="step-list">' + stepStr + '\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span>' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 3) {
													// 软装
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">软装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 4) {
													// 家具套餐
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">家具套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 5) {
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">家电套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												} else if (order.productType >= 6 && order.productType <= 11) {
													var proType = order.productType
														editState = order.editState
														, inputVal = ""
														, isShow = ""
														, editInfo = "系统默认"
														, dataid = null;
													switch(proType) {
														case 6: 
															inputVal = "地板";
															break;
														case 7:
															inputVal = "乳胶漆";
															break;
														case 8:
															inputVal = "壁纸";
															break;
														case 9: 
															inputVal = "瓷砖";
															break;
														case 10:
															inputVal = "厨卫天花";
															break;
														case 11:
															inputVal = "室内门";
													}
													if (editState == 0) {
														editInfo = "系统默认";
														isShow = "on";

													} else if (editState == 1) {
														editInfo = "实际面积";
														isShow = "";
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<i class="iconfont choose-cbtn" data-type="kuaifan-order" data-id="' + order.orderId + '">&#xe60b;</i>\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																	</div>\
																	<div class="step-list">\
																		<div class="row">\
																			<span>[' + editInfo + ']-' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																			<br/><span class="edit-info ' + isShow + '">注：具体以实际量房数据为准。</span>\
																			<span class="price">￥' + order.total + '</span>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">￥<i id="price_' + order.orderId + '">' + order.total + '</i></span>\
															</div>\
														</div>\
													';
												}
											} else if (order.state == 2) {
												// 已完工
												if (order.productType == 1) {
													var layout = order.layout
														, nums = order.nums
														, inputVal = ""
														, dataid = null;
													if (layout) {
														switch(layout) {
															case 1: 
																inputVal = "一居室";
																dataid = 1;
																break;
															case 2:
																inputVal = "两居室";
																dataid = 2;
																break;
															case 3:
																inputVal = "三居室";
																dataid = 3;
														}
													} else {
														inputVal = "单间";
														dataid = 4;
													}
													// 快翻订单
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">快翻套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 2) {
													// 硬装订单
													yzOrderDtl[order.orderId] = {};
													yzOrderDtl[order.orderId].balconyNum = order.balconyNum;
													yzOrderDtl[order.orderId].toiletNum = order.toiletNum;
													var acreage = order.acreage
														, balconyNum = order.balconyNum
														, toiletNum = order.toiletNum
														, productStyle = order.productStyle
														, balconyNumTxt = ""
														, toiletNumTxt = "";
													switch(balconyNum) {
														case 1: 
															balconyNumTxt = "一个阳台";
															break;
														case 2:
															balconyNumTxt = "两个阳台";
															break;
													}
													switch(toiletNum) {
														case 1: 
															toiletNumTxt = "一个卫生间";
															break;
														case 2:
															toiletNumTxt = "两个卫生间";
															break;
													}
													
													str += '\
														<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">硬装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose Horizontal">\
																		<div class="form-set square yz-square">\
																			<p class="item">\
																				<em></em>\
																				<input type="text" placeholder="100平米" readonly="readonly" data-id="1" value="' + order.acreage + '平米">\
																			</p>\
																		</div>\
																		<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																			</p>\
																		</div>\
																		<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																				<span><i></i></span>\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span>' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 3) {
													// 软装
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">软装套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 4) {
													// 家具套餐
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">家具套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType == 5) {
													var layout = order.layout
														, inputVal = ""
														, dataid = null;
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">家电套餐</span>\
																		<a class="delete" data-id="' + order.orderId + '"><i class="iconfont">&#xe60b;</i>删除</a>\
																	</div>\
																	<div class="choose">\
																		<div class="form-set kf-house" id="order_' + order.orderId + '">\
																			<p class="droplist item">\
																				<em></em>\
																				<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																			</p>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												} else if (order.productType >= 6 && order.productType <= 11) {
													var proType = order.productType
														, inputVal = ""
														, dataid = null;
													switch(proType) {
														case 6: 
															inputVal = "地板";
															break;
														case 7:
															inputVal = "乳胶漆";
															break;
														case 8:
															inputVal = "壁纸";
															break;
														case 9: 
															inputVal = "瓷砖";
															break;
														case 10:
															inputVal = "厨卫天花";
															break;
														case 11:
															inputVal = "室内门";
													}
													str += '\
														<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
															<div class="top-bottom">订单编号：' + order.orderId + '</div>\
															<div class="cnt">\
																<div class="sub-cnt">\
																	<div class="name">\
																		<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																	</div>\
																	<div class="step-list">\
																		<div class="row">\
																			<span>' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																			<span class="price">￥' + order.total + '</span>\
																		</div>\
																	</div>\
																</div>\
															</div>\
															<div class="top-bottom">\
																<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
																<span class="price">已完工</span>\
															</div>\
														</div>\
													';
												}
											}
										} else if (type == 4) {
											// 历史订单
											var orderStep = "";
											if (order.state == 0) {
												orderStep = "未支付";
											} else if (order.state == 1) {
												orderStep = "开工中";
											} else if (order.state == 2) {
												orderStep = "已完工";
											}
											if (order.productType == 1) {
												var layout = order.layout
													, nums = order.nums
													, inputVal = ""
													, dataid = null;
												if (layout) {
													switch(layout) {
														case 1: 
															inputVal = "一居室";
															dataid = 1;
															break;
														case 2:
															inputVal = "两居室";
															dataid = 2;
															break;
														case 3:
															inputVal = "三居室";
															dataid = 3;
													}
												} else {
													inputVal = "单间";
													dataid = 4;
												}
												// 快翻订单
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">快翻套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 2) {
												// 硬装订单
												yzOrderDtl[order.orderId] = {};
												yzOrderDtl[order.orderId].balconyNum = order.balconyNum;
												yzOrderDtl[order.orderId].toiletNum = order.toiletNum;
												var acreage = order.acreage
													, balconyNum = order.balconyNum
													, toiletNum = order.toiletNum
													, productStyle = order.productStyle
													, balconyNumTxt = ""
													, toiletNumTxt = "";
												switch(balconyNum) {
													case 1: 
														balconyNumTxt = "一个阳台";
														break;
													case 2:
														balconyNumTxt = "两个阳台";
														break;
												}
												switch(toiletNum) {
													case 1: 
														toiletNumTxt = "一个卫生间";
														break;
													case 2:
														toiletNumTxt = "两个卫生间";
														break;
												}
												
												str += '\
													<div class="order yingzhuang-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">硬装套餐</span>\
																</div>\
																<div class="choose Horizontal">\
																	<div class="form-set square yz-square">\
																		<p class="item">\
																			<em></em>\
																			<input type="text" placeholder="100平米" readonly="readonly" data-id="1" value="100平米">\
																		</p>\
																	</div>\
																	<div class="form-set path-room yz-bathroom" id="toilet_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + toiletNumTxt + '" readonly="readonly" data-id="' + toiletNum + '">\
																		</p>\
																	</div>\
																	<div class="form-set sun-plateform yz-platform" id="balcony_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + balconyNumTxt + '" readonly="readonly" data-id="' + balconyNum + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span>' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 3) {
												// 软装
												var layout = order.layout
													, inputVal = ""
													, dataid = null;
												switch(layout) {
													case 1: 
														inputVal = "一居室";
														dataid = 1;
														break;
													case 2:
														inputVal = "两居室";
														dataid = 2;
														break;
													case 3:
														inputVal = "三居室";
														dataid = 3;
												}
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">软装套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 4) {
												// 家具套餐
												var layout = order.layout
													, inputVal = ""
													, dataid = null;
												switch(layout) {
													case 1: 
														inputVal = "一居室";
														dataid = 1;
														break;
													case 2:
														inputVal = "两居室";
														dataid = 2;
														break;
													case 3:
														inputVal = "三居室";
														dataid = 3;
												}
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">家具套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType == 5) {
												var layout = order.layout
													, inputVal = ""
													, dataid = null;
												switch(layout) {
													case 1: 
														inputVal = "一居室";
														dataid = 1;
														break;
													case 2:
														inputVal = "两居室";
														dataid = 2;
														break;
													case 3:
														inputVal = "三居室";
														dataid = 3;
												}
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">家电套餐</span>\
																</div>\
																<div class="choose">\
																	<div class="form-set kf-house" id="order_' + order.orderId + '">\
																		<p class="droplist item">\
																			<em></em>\
																			<input type="text" value="' + inputVal + '" readonly="readonly" data-id="' + dataid + '">\
																		</p>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											} else if (order.productType >= 6 && order.productType <= 11) {
												var proType = order.productType
													, inputVal = ""
													, dataid = null;
												switch(proType) {
													case 6: 
														inputVal = "地板";
														break;
													case 7:
														inputVal = "乳胶漆";
														break;
													case 8:
														inputVal = "壁纸";
														break;
													case 9: 
														inputVal = "瓷砖";
														break;
													case 10:
														inputVal = "厨卫天花";
														break;
													case 11:
														inputVal = "室内门";
												}
												str += '\
													<div class="order kuaifan-order" id="orderCnt_' + order.orderId + '">\
														<div class="top-bottom">订单编号：' + order.orderId + '</div>\
														<div class="cnt">\
															<div class="sub-cnt">\
																<div class="name">\
																	<span data-id="' + order.orderId + '">' + order.productName + '</span>\
																</div>\
																<div class="step-list">\
																	<div class="row">\
																		<span>' + inputVal + '-' + ((proType == 11) ? (order.nums + '樘') : (order.acreage + "平方米")) + '</span>\
																		<span class="price">￥' + order.total + '</span>\
																	</div>\
																</div>\
															</div>\
														</div>\
														<div class="top-bottom">\
															<span class="date-time">' + Tools.timeFormat(order.createTime) + '</span>\
															<span class="price">' + orderStep + '</span>\
														</div>\
													</div>\
												';
											}
										}
									});	
								} else {
									// 订单列表空
									str = '\
										<div class="order-empty">\
											<h3>这里还没有订单，您可以</h3>\
											<h4>查看其他状态订单，或者</h4>\
											<a href="' + baseUrl + 'html/user/" class="button-2">去首页看看</a>\
										</div>\
									';
								}
								console.log(priceDetail);
								console.log(yzOrderDtl);
								// This._getPrice();//计算新价格并写入
								This.EL_orderLis.html(str);
								if (!!orderList.length) {
									$(document).off('click').on('focus', '.input-square', function() {
										$(this).val($(this).val().replace(/[^\d]/g,""));
									});
									$(document).off('click').on('blur', '.input-square', function() {
										var id = $(this).attr("data-id");
										var acreage = parseInt($(this).val()).toString().replace(/(\d{3})(.+)/, '$1');
										This._ajaxModifyOrder(id, '"acreage":' + parseInt(acreage));
										$(this).val(parseInt($(this).val()).toString().replace(/(\d{3})(.+)/, '$1') + "平米");
									});
									[].forEach.call(orderList, function(order) {
										if (order.state == 0) {
											var orderId = order.orderId
												, initId = 0
												, initId_t = 0
												, initId_b = 0;
											if (order.productType == 1) {
												initId = order.layout;
												This._eventBindKFSlide($('#order_' + orderId), orderId, initId);

											} else if (order.productType == 2) {
												initId_t = order.toiletNum;
												initId_b = order.balconyNum;
												This._eventBindYZToiletSlide($('#toilet_' + orderId), orderId, initId_t);
												This._eventBindYZBalconySlide($('#balcony_' + orderId), orderId, initId_b);
											} else if (order.productType == 3) {
												// 软装
												initId = order.layout;
												This._eventBindRZSlide($('#order_' + orderId), orderId, initId);
											} else if (order.productType == 4) {
												// 家具
												initId = order.layout;
												This._eventBindJJSlide($('#order_' + orderId), orderId, initId);
											} else if (order.productType == 5) {
												// 家电
												initId = order.layout;
												This._eventBindJDSlide($('#order_' + orderId), orderId, initId);
											}
											payButton.html('99元开工');
											priceTxtEl.html('需支付定金');
										} else if (order.state == 1) {
											payButton.html('结算');
											priceTxtEl.html('已支付定金');
											$('input').css("textAlign", "center");
										} else if (order.state == 2) {
											$('input').css("textAlign", "center");
										} else {
											
											$('input').css("textAlign", "center");
										}
									});
								}
								// 绑定删除
								$('.not-pay .delete').off('click').on('click', function() {
									var orderId = $(this).attr("data-id");
									This._ajaxCancelOrder(orderId);
									This._unChooseOrder(orderId); // 删除已选order中的当前order
								});
								// 绑定选中取消
								$('.sub-cnt .name .choose-cbtn').off('click').on('click', function() {
									var orderId = $(this).attr('data-id');
									$('.sub-cnt .name .choose-cbtn').removeClass("on");
									if ($(this).attr('data-protype') && $(this).attr('data-protype') == "yingzhuang") {
										productType = 2;
									} else {
										productType = 1;
									}
									if (!$(this).hasClass("on")) {
										selectedOrder = orderId;
										$(this).addClass("on");
										priceEl.html("￥" + parseFloat(priceDetail[selectedOrder]));
										// if (payState == 2) {
										// 	priceEl.html("￥" + (parseFloat(priceDetail[selectedOrder]) - 99));
										// } else if (payState == 1) {
										// 	priceEl.html("￥" + parseFloat(priceDetail[selectedOrder]));
										// }
									}
								});
								
							} catch(err) {
								alert(JSON.stringify(err));
								console.log(err);
							}
							
						} else if (res.ret == -1) {
							dialog.add("ret:-1 订单列表返回失败，请重试！");
						} else if (res.ret == 302) {
							// dialog.add("需登录！");
							checkUsr.doJump();
						}
					},
					error: function(res) {
						alert("err:" + JSON.stringify(res));
					}
				});
			},
			// js-jdk签证所需信息
			wxPay_qianzheng: function(payState, type) {
				var This = this;
				$.ajax({
					url: baseUrl + "wxsingctrl/sigin.htm?url=" + window.location.href,
					dataType: "json",
					success: function(res) {
						// alert(JSON.stringify(res));
						This.wxPay_getParams(payState, type);
					},
					error: function(res) {
						alert(JSON.stringify(res));
					}
				});
			},
			// 获取支付方法所需参数 payState 支付阶段（0:99/1:结算） type 产品类型(硬装/翻新)
			wxPay_getParams: function(payState, type) {
				// alert(payState);
				// alert(type);
				var This = this
					, params = ""
					, payState = payState || 1;
				if (payState == 1) {
					params = "&isFirst99=true";
				} else {
					if (type == 2) {
						// 硬装
						var paystep = $('#orderCnt_' + selectedOrder).attr('data-paystep');
						if (!!!paystep) {
							dialog.add("当前选中的订单无可支付项！");
							return;
						}
						params = "&stepId=" + paystep + "&isFirst99=false";
					} else {
						params = "";
					}
				}
				
				// alert(params);
				$.ajax({
					url: baseUrl + "pay/preparePay.htm?orderIds=" 
						+ selectedOrder 
						+ params,
					dataType: "json",
					success: function(res) {
						// alert(JSON.stringify(res));
						try {
							if (res.ret == 1) {
								// 成功获取参数
								function onBridgeReady(){
									WeixinJSBridge.invoke('getBrandWCPayRequest', {
											"appId": "wx4d6a2dce4f09dfd0", //公众号名称，由商户传入     
											"timeStamp": res.timeStamp, //时间戳，自1970年以来的秒数     
											"nonceStr": res.nonceStr, //随机串     
											"package": res.package,     
											"signType": res.signType, //微信签名方式：     
											"paySign": res.paySign //微信签名 
										},
										function(res){     
											if(res.err_msg == "get_brand_wcpay_request:ok" ) {
												This.getOrder(2); // 跳到已支付
											}
										}
									); 
								}
								if (typeof WeixinJSBridge == "undefined"){
									if( document.addEventListener ){
									   document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
									}else if (document.attachEvent){
									   document.attachEvent('WeixinJSBridgeReady', onBridgeReady); 
									   document.attachEvent('onWeixinJSBridgeReady', onBridgeReady);
									}
								}else{
									onBridgeReady();
								}
							}
						} catch(e) {
							alert(JSON.stringify(e));
						}
					},
					error: function(res) {
						alert(JSON.stringify(res));
					}
				});
			}
		};
		// bbb
try {
		shopCart.init();
} catch (e) {
	alert(JSON.stringify(e));
}
	});
});
define('entry/js/src/userproduct.js',['../core/core'], function(core) {
	core.onrender("userproduct", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var topNav = $('.topnav', dom);
		var topNavs = $('.topnav .nav-item', dom);
		var sliders = $('.swiper-top', dom);
		console.log(topNav);
		var mySwiper1 = new Swiper('.swiper-container-h',{
			// direction: 'vertical'
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				// topNav.addClass("show");
				$(topNavs[index]).addClass("on").siblings().removeClass("on");

				// 延迟加载
				var imgs = $('img', $(sliders[index]));
				[].forEach.call(imgs, function(img) {
					var src = $(img).attr("data-src");
					if (src) {
						$(img).attr("src", src);
						$(img).removeAttr("data-src");
					}
				});
			}
		});
		var mySwiper2 = new Swiper('.swiper-container-v1',{
			pagination: '.swiper-pagination-h1',
			direction: 'vertical'
		});
		var mySwiper3 = new Swiper('.swiper-container-v2',{
			pagination: '.swiper-pagination-h2',
			direction: 'vertical'
		});
		var mySwiper4 = new Swiper('.swiper-container-v3',{
			pagination: '.swiper-pagination-h3',
			direction: 'vertical'
		});
		var mySwiper5 = new Swiper('.swiper-container-v4',{
			pagination: '.swiper-pagination-h4',
			direction: 'vertical'
		});
	});
});
define('entry/js/src/redirect',['../core/core'], function(core) {
	core.onrender("redirect", function(dom) {
		var url = location.search;
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		if (url) {
			var code = url.replace(/\?/,"").split("&")[0].split("=")[1];
			$.ajax({
				url: baseUrl + "user/callBackGetWxOpenIdUserInfo.htm?code=" + code,
				dataType: "json",
				success: function(res) {
					// alert(JSON.stringify(res));
					var ret = res.ret;
					var uinfo = res.userInfo;
					if (ret == 2) {
						var nickName = uinfo.nickName
							, mobile = uinfo.mobile
							, head = uinfo.head
							, param = "nickName=" + nickName + "&mobile=" + mobile + "&head=" + head;
						// window.location.href = "http://www.s-jz.com/html/ucenter/uedit.html?" + param;
						window.location.href = baseUrl + "html/ucenter/uedit.html?" + param;
					} else if (ret == 1) {
						// 登陆成功
						// window.location.href = "http://www.s-jz.com/";
						if (localStorage.getItem("_prepage")) {
							window.location.href = localStorage.getItem("_prepage");
						} else {
							window.location.href = baseUrl + "html/user/";
						}
					}
				},
				error: function(data){
					alert(JSON.stringify(data));
				}
			});
		} else {
			window.location = baseUrl + "html/user/";;
		}
		
	});
});
define('entry/js/src/index2.0',['../core/core'], function(core) {
	core.onrender("index-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools
			, u = navigator.userAgent
			, isAndroid = u.indexOf('Android') > -1 || u.indexOf('Linux') > -1 //android终端或者uc浏览器
			, EL_slide = $('#focus-slide', dom)
			, EL_compare = $('.compare', dom)
			, EL_topCmp = $('.compare .top', dom)
			, EL_topBtm = $('.compare .bottom', dom)
			, EL_androidCmp = $('#compare-slide', dom)
			, EL_topBg = $('.compare .all-img', dom)
			, winWidth = $('body').width()
			, winHeight = $('body').height();
		EL_slide.css("height", winWidth * 0.55 + "px");
		EL_topBg.css("width", winWidth + "px");
		if (isAndroid) {
			EL_compare.hide();
			EL_androidCmp.show();
			EL_androidCmp.css("height", (winHeight - winWidth * 0.55 - 50) + "px");
		} else {
			EL_compare.show();
			EL_androidCmp.hide();
			EL_compare.css("height", (winHeight - winWidth * 0.55 - 50) + "px");
		}
		
		var focusSlide = new Swiper('#focus-slide',{
			// direction: 'vertical'
			autoplay: 5000,
			pagination: '.swiper-pagination'
		});
		var compareSlide = new Swiper('#compare-slide',{
			effect : 'fade',
			fade: {
			  crossFade: false,
			}
		});

		var downLeft = [0,0], initWid, initLeft;
		EL_topCmp.on('touchstart', function(e) {
			var touchs = e.changedTouches[0];
			var tx = touchs.pageX;
			downLeft.shift();
			downLeft.push(tx);
			initWid = EL_topCmp.width();
			initLeft = winWidth - initWid;
			// console.log(downLeft);
		});
		$(dom).on('touchmove', '.compare .top', function(e) {
			e.preventDefault();
			var touchs = e.changedTouches[0];
			var tx = touchs.pageX;
			var moveDis = 0;
			downLeft.shift();
			downLeft.push(tx);
			// console.log(downLeft);
			moveDis = downLeft[1] - downLeft[0];
			initWid -= moveDis;
			initLeft += moveDis;
			if (initLeft < 0) {
				initLeft = 0;
			} else if (initLeft > winWidth) {
				initLeft = winWidth;
			}
			if (initWid > winWidth) {
				initWid = winWidth;
			} else if (initWid < 0) {
				initWid = 0;
			}
			console.log(tx,initWid);
			EL_topCmp.attr("style", "left:auto; -webkit-transition-duration:0s; -webkit-transform: translate3d(" + initLeft + "px, 0px, 0px); width:" + initWid + "px; background-size:" + 1 / (initWid / winWidth) * 100 + "% 100%");
		});
		$(dom).on('touchend', '.compare .top', function(e) {
			e.preventDefault();
			var touchs = e.changedTouches[0];
			EL_topCmp.removeAttr("style");
		});
	});
});
define('entry/js/src/kfstyle2.0',['../core/core', './jump', './component/dialog', '../src/order'], function(core, checkUsr, dialog, OrderConfig) {
	core.onrender("kf-style-2-0", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		// 设置跳转返回目标页
		localStorage.setItem("_prepage", window.location.href);
		
		var baseUrl = "http://www.s-jz.com/pub/Sbuild/";
		var kftype = location.hash.replace(/#!_/,"") || "art";
		var productStyle = "";
		var Tools = core.Tools
			, EL_comparePic = $('.area-compare .onhide');
		
		$(document).on('click', '.area-compare .onhide', function() {
			$(this).removeClass('onhide').addClass('onshow').siblings().addClass('onhide');
		});	

	});
});
// main.js
require([
	//'entry/js/src/index',
	//'entry/js/src/workerapply',
	//'entry/js/src/quote', 
	//'entry/js/src/quoteres', 
	//'entry/js/src/detail199.js', 
	//'entry/js/src/userindex.js', 
	'entry/js/src/usernewyingzhuang.js', 
	'entry/js/src/usernewruanzhuang.js', 
	'entry/js/src/usernewjiaju.js', 
	'entry/js/src/usernewjiadian.js', 
	'entry/js/src/kfuserindex.js', 
	'entry/js/src/kfstylenav.js', 
	'entry/js/src/jfpart.js', 
	'entry/js/src/shopcart.js', 
	'entry/js/src/userproduct.js',
	'entry/js/src/redirect',
	// 2.0
	'entry/js/src/index2.0',
	'entry/js/src/kfstyle2.0'], function() {
});
define("entry/js/main", function(){});

}());