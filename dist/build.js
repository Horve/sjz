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
		}
	};
	var Tools = Tools;
	return Tools;
});
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
define('entry/js/core/core',['../lib/zepto', './tools','../lib/swiper.js'], function(zepto, tools) {
	// return $;
	var core = {};
	core.Tools = tools;
	// core.Swiper = swiper;
	core.onrender = function(id, callback) {
		var dom = $('.page');
		if(dom.attr("data-render-id") === id) {
			callback(dom);
		}
	}
	return core;
});
define('entry/js/src/component/slideOptions',['../../core/core'], function(core) {
	var isfirst = true;
	var isChoose = false;
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
				console.log(111);
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
				$('.page').append(slide);
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
				if(callback && typeof callback === "function") {
					callback({
						id: $(this).attr("data-id"),
						txt: $(this).find('span').html()
					});
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
// workerapply.js
define('entry/js/src/workerapply',['../core/core', './component/slideOptions'], function(core, slideOption) {
	core.onrender("workerapply", function(dom) {
		slideOption.add($('#wk-apply-formset'), {
			title: "选择工种",
			data: [
				{
					id: 1,
					txt: "水电工"
				},
				{
					id: 2,
					txt: "木工"
				},
				{
					id: 3,
					txt: "瓦工"
				},
				{
					id: 4,
					txt: "油工"
				},
				{
					id: 5,
					txt: "小工"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#wk-apply-formset input').val(data.txt);
				$('#wk-apply-formset input').attr("data-id", data.id);
			}
		});
		var workerApply = {
			DOM_DROP: $('#wk-apply-type'),
			DOM_DROPLIST: $('#wk-apply-formset .form-set-sub'),
			DOM_DROPITEM: $('#wk-apply-formset .form-set-sub .item-sub'),

			init: function() {
				var THIS = this;
				THIS.DOM_DROP.off("click").on("click", function() {
					THIS.DOM_DROPLIST.toggleClass("on");
				});
				THIS.DOM_DROPITEM.off("click").on("click", function() {
					var index = $(this).index();
					var txt = $(this).text();
					console.log(txt);
					THIS.DOM_DROP.find('input').val(txt);
					THIS.DOM_DROPLIST.removeClass("on");
				});


			}
		};
		workerApply.init();
	});
});
define('entry/js/src/quote',['../core/core', './component/slideOptions'], function(core, slideOption) {
	core.onrender("quote", function(dom) {
		slideOption.add($('#quote-new-house'), {
			title: "选择新房装修类型",
			data: [
				{
					id: 1,
					txt: "经济装 199/㎡"
				},
				{
					id: 2,
					txt: "品味装 299/㎡"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});

		// 旧房装修
		slideOption.add($('#quote-old-house'), {
			title: "选择旧房装修类型",
			data: [
				{
					id: 1,
					txt: "经济改造 99+199/㎡"
				},
				{
					id: 2,
					txt: "经济改造 99+299/㎡"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-old-house input').val(data.txt);
				$('#quote-old-house input').attr("data-id", data.id);
			}
		});

		slideOption.add($('#h-shi'), {
			title: "房型-室",
			data: [
				{
					id: 1,
					txt: "1"
				},
				{
					id: 2,
					txt: "2"
				},
				{
					id: 3,
					txt: "3"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#h-shi input').val(data.txt);
				$('#h-shi input').attr("data-id", data.id);
			}
		});

		slideOption.add($('#h-ting'), {
			title: "房型-厅",
			data: [
				{
					id: 1,
					txt: "0"
				},
				{
					id: 2,
					txt: "1"
				},
				{
					id: 3,
					txt: "2"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#h-ting input').val(data.txt);
				$('#h-ting input').attr("data-id", data.id);
			}
		});

		slideOption.add($('#h-chu'), {
			title: "房型-厨",
			data: [
				{
					id: 1,
					txt: "0"
				},
				{
					id: 2,
					txt: "1"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#h-chu input').val(data.txt);
				$('#h-chu input').attr("data-id", data.id);
			}
		});

		slideOption.add($('#h-wei'), {
			title: "房型-卫",
			data: [
				{
					id: 1,
					txt: "0"
				},
				{
					id: 2,
					txt: "1"
				},
				{
					id: 3,
					txt: "2"
				}
			],
			choose: true, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#h-wei input').val(data.txt);
				$('#h-wei input').attr("data-id", data.id);
			}
		});
	});
	
});
define('entry/js/src/quoteres',['../core/core', './component/slideOptions'], function(core, slideOption) {
	core.onrender("quoteres", function(dom) {
		var Tools = core.Tools;

		slideOption.add($('.block.shuidian'), {
			title: "水电综合项目",
			data: [
				{
					id: 1,
					txt: "石膏板平顶"
				},
				{
					id: 2,
					txt: "防水处理"
				},
				{
					id: 3,
					txt: "吊顶"
				},
				{
					id: 4,
					txt: "PPR水管明装"
				},
				{
					id: 1,
					txt: "PPR水管暗装"
				},
				{
					id: 5,
					txt: "PVC管敷设暗线"
				},
				{
					id: 6,
					txt: "安装PVC分线盒"
				},
				{
					id: 2,
					txt: "安装PVC暗盒"
				},
				{
					id: 7,
					txt: "开补槽"
				},
				{
					id: 8,
					txt: "插座/开关安装"
				},
				{
					id: 9,
					txt: "配电线安装等"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});
		slideOption.add($('.block.wagong'), {
			title: "瓦工项目",
			data: [
				{
					id: 1,
					txt: "地面水泥找平"
				},
				{
					id: 2,
					txt: "墙地面基层处理抹灰找平拉毛"
				},
				{
					id: 3,
					txt: "包立管"
				},
				{
					id: 4,
					txt: "贴地砖"
				},
				{
					id: 5,
					txt: "踢脚线"
				},
				{
					id: 6,
					txt: "贴墙砖"
				},
				{
					id: 7,
					txt: "墙地面勾缝"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});
		slideOption.add($('.block.yougong'), {
			title: "油工项目",
			data: [
				{
					id: 1,
					txt: "墙顶面铲墙皮"
				},
				{
					id: 2,
					txt: "墙顶面批刮腻子打磨"
				},
				{
					id: 3,
					txt: "墙顶面石膏找平"
				},
				{
					id: 4,
					txt: "刷漆人工费"
				},
				{
					id: 5,
					txt: "墙顶面基层处理封墙锢"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});
		slideOption.add($('.block.other'), {
			title: "其他项目",
			data: [
				{
					id: 1,
					txt: "垃圾清运费"
				},
				{
					id: 2,
					txt: "材料搬运费"
				},
				{
					id: 3,
					txt: "小五金安装"
				}
			],
			choose: false, // 是否是选项列表
			// 设置初始选项 不设置为null
			initOption: function(el, datas) {
				$(el).find('input').val(datas[0].txt);
				$(el).find('input').attr("data-id", datas[0].id);
			},
			callback: function(data) {
				$('#quote-new-house input').val(data.txt);
				$('#quote-new-house input').attr("data-id", data.id);
			}
		});

		var quoteres = {
			DOM_item_block: $('.block-item'),
			DOM_item_block_item: $('.block-item .block'),
			DOM_button: $('.quoteres .button-comm'),

			init: function() {
				var _this = this;
				Tools.scrollNum($('.quote-price .number'));
				var width_block = Tools.getCurrentStyle(this.DOM_item_block[0], "width");
				var width_item = Tools.getCurrentStyle(this.DOM_item_block_item[0], "width");
				this.DOM_item_block.css("height", width_block);
				this.DOM_item_block_item.css("height", width_item);
				setTimeout(function() {
					[].forEach.call(_this.DOM_item_block_item, function(item, index) {
						$(item).addClass("animation" + (index + 1));
					});
					_this.DOM_button.addClass("animation5");
				}, 0);
			}
		};
		quoteres.init();	
	});
	
});
define('entry/js/src/detail199.js',['../core/core'], function(core) {
	core.onrender("detail-199", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;

		var detail199 = {
			DOM_single: $('.single-page', dom),
			DOM_price: $('#detail-199-price', dom),

			init: function() {
				var _this = this;
				this.DOM_single
				var price_h = parseFloat(Tools.getCurrentStyle(_this.DOM_price[0], "width")) * 0.4;
				var single_h = parseFloat(Tools.getCurrentStyle(_this.DOM_single[0], "width")) / 0.5633;
				_this.DOM_price.css("height", price_h + "px");
				_this.DOM_single.css("height", single_h + "px");
				_this.DOM_price.addClass("price-animation");
			}
		};

		detail199.init();
	});
});
define('entry/js/src/userindex.js',['../core/core'], function(core) {
	core.onrender("userindex", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var topNav = $('.topnav', dom);
		var topNavs = $('.topnav .nav-item', dom);
		var sliders = $('.swiper-top', dom);
		console.log(topNav);
		var mySwiper1 = new Swiper('.swiper-container-h',{
			// direction: 'vertical'
			onInit: function(swiper){
		    	console.log("init");
		    	$('.swiper-slide-one .txt').addClass("animate_1");
		    	$('.swiper-slide-one .pic').addClass("animate_2");
		    },
			onSlideChangeEnd: function(swiper){
				var index = swiper.activeIndex;
				if (index == 1) {
					$('.swiper-slide-two .txt').addClass("animate_1");
		    		$('.swiper-slide-two .pic').addClass("animate_2");
				}
			}
		});
	});
});
define('entry/js/src/usernewyingzhuang.js',['../core/core'], function(core) {
	core.onrender("user-new-yingzhuang", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
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
	});
});
define('entry/js/src/usernewruanzhuang.js',['../core/core'], function(core) {
	core.onrender("user-new-ruanzhuang", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
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
	});
});
define('entry/js/src/usernewjiaju.js',['../core/core'], function(core) {
	core.onrender("user-new-jiaju", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
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
	});
});
define('entry/js/src/usernewjiadian.js',['../core/core'], function(core) {
	core.onrender("user-new-jiadian", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
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
	});
});
define('entry/js/src/kfuserindex.js',['../core/core'], function(core) {
	core.onrender("kf-userindex", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var mySwiper1 = new Swiper('.swiper-container',{
			direction: 'vertical'
		});
	});
});
define('entry/js/src/kfstylenav.js',['../core/core'], function(core) {
	core.onrender("kf-style", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var imgs = $('img', $('.swiper-container'));
		var items = $('.choose-style .items span', dom);
		var itemsTxt = $('.choose-style .items-intro', dom);
		var itemsPrice = $('.choose-style .price', dom);
		var swipcnt = $('.swiper-container', dom);
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
		$(items).off('click').on('click', function() {
			var index = $(this).index();
			$(this).addClass("on").siblings().removeClass("on");
			console.log(index);
			var txt = "";
			var price = 0;
			switch(index) {
				case 0: 
					txt = "一室一厅一厨一卫";
					price = 3600;
					break;
				case 1: 
					txt = "两室一厅一厨一卫";
					price = 4800;
					break;
				case 2: 
					txt = "三室一厅一厨一卫";
					price = 6500;
					break;
				case 3: 
					txt = "单间";
					price = 2999;
					break;
			}
			itemsTxt.html(txt);
			itemsPrice.html(price);
		});
		var imgLists = $('img', '.pic-lists');
    	Tools.lazyLoad(imgLists);
	});
});
define('entry/js/src/jfpart.js',['../core/core'], function(core) {
	core.onrender("jf-part", function(dom) {
		/*-webkit-animation: .5s detail-price-199;*/
		var Tools = core.Tools;
		var swipcnt = $('.swiper-container', dom);
		var imgs = $('img', $('.swiper-container'));
		var chosBtns = $('.price-sec .btn', dom);
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
			if ($(this).hasClass("on")) {
				$(this).removeClass("on");
			} else {
				$(this).addClass("on");
			}
		});
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
// main.js
require([
	'entry/js/src/workerapply',
	'entry/js/src/quote', 
	'entry/js/src/quoteres', 
	'entry/js/src/detail199.js', 
	'entry/js/src/userindex.js', 
	'entry/js/src/usernewyingzhuang.js', 
	'entry/js/src/usernewruanzhuang.js', 
	'entry/js/src/usernewjiaju.js', 
	'entry/js/src/usernewjiadian.js', 
	'entry/js/src/kfuserindex.js', 
	'entry/js/src/kfstylenav.js', 
	'entry/js/src/jfpart.js', 
	'entry/js/src/userproduct.js'], function() {
});
define("entry/js/main", function(){});

}());