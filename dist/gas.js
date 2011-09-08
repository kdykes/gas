(function(window, undefined) {
/*!
 * GAS - Google Analytics on Steroids v0.1
 *
 * @preserve Copyright 2011, Cardinal Path
 * @preserve Copyright 2011, Direct Performance
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */

/**
 * Google Analytics original _gaq.
 *
 * This never tries to do something that is not supposed to. So it won't break
 * in the future.
 */
window['_gaq'] = window['_gaq'] || [];

var _prev_gas = window['_gas'] || [];

// Avoid duplicate definition
if (_prev_gas._accounts_length >= 0) {
    return;
}

//Shortcuts, these speed up the code
var document = window.document,
    toString = Object.prototype.toString,
    hasOwn = Object.prototype.hasOwnProperty,
    push = Array.prototype.push,
    slice = Array.prototype.slice,
    trim = String.prototype.trim,
    sindexOf = String.prototype.indexOf,
    aindexOf = Array.prototype.indexOf,
    url = document.location.href;


/**
 * _gas main object.
 *
 * It's supposed to be used just like _gaq but here we extend it. In it's core
 * everything pushed to _gas is run through possible hooks and then pushed to
 * _gaq
 */
window['_gas'] = _gas = {
    _accounts: {},
    _accounts_length: 0,
    _hooks: {},
    _queue: _prev_gas,
    _default_tracker: '_gas1',
    gh: {}
};

/**
 * First standard Hook that is responsible to add next Hooks
 *
 * _addHook calls always reurn false so they don't get pushed to _gaq
 * @param {string} fn The function you wish to add a Hook to.
 * @param {function()} cb The callback function to be appended to hooks.
 * @return {boolean} Always false.
 */
window._gas._hooks['_addHook'] = [function(fn, cb) {
    if (typeof fn === 'string' && typeof cb === 'function') {
        if (typeof window._gas._hooks[fn] === 'undefined') {
            window._gas._hooks[fn] = [];
        }
        window._gas._hooks[fn].push(cb);
    }
    return false;
}];

/**
 * Construct the correct account name to be used on _gaq calls.
 *
 * The account name for the first unamed account pushed to _gas is the standard
 * account name. It's pushed without the account name to _gaq, so if someone
 * calls directly _gaq it works as expected.
 * @param {string} acct Account name.
 * @return {string} Correct account name to be used already with trailling dot.
 */
function _build_acct_name(acct) {
    return acct === window._gas._default_tracker ? '' : acct + '.';
}

function _gaq_push(arr) {
    if (_gas.debug_mode) {
        try {
            console.log(arr);
        }catch (e) {}
    }
    return window._gaq.push(arr);
}

/**
 * Everything pushed to _gas is executed by this call.
 *
 * This function should not be called directly. Instead use _gas.push
 * @return {number} This is the same return as _gaq.push calls.
 */
window._gas._execute = function() {
    var args = slice.call(arguments),
        sub = args.shift(),
        gaq_execute = true,
        i, foo, hooks, acct_name, repl_sub;

    if (typeof sub === 'function') {
        // Pushed functions are executed right away
        return _gaq_push(
            (function(s) {
                return function() {
                    // pushed functions receive helpers through this object
                    s.call(window._gas.gh);
                };
            })(sub)
        );

    }else if (typeof sub === 'object' && sub.length > 0) {
        foo = sub.shift();

        if (sindexOf.call(foo, '.') >= 0) {
            acct_name = foo.split('.')[0];
            foo = foo.split('.')[1];
        }else {
            acct_name = undefined;
        }

        // Execute hooks
        hooks = window._gas._hooks[foo];
        if (hooks && hooks.length > 0) {
            for (i = 0; i < hooks.length; i++) {
                try {
                    repl_sub = hooks[i].apply(window._gas.gh, sub);
                    if (repl_sub === false) {
                        // Returning false from a hook cancel the call
                        gaq_execute = false;
                    }
                    if (repl_sub && repl_sub.length > 0) {
                        // Returning an array changes the call parameters
                        sub = repl_sub;
                    }
                }catch (e) {
                    if (foo !== '_trackException') {
                        window._gas.push(['_trackException', e]);
                    }
                }
            }
        }
        // Cancel execution on _gaq if any hook returned false
        if (gaq_execute === false) {
            return 1;
        }
        // Intercept _setAccount calls
        if (foo === '_setAccount') {

            for (i in window._gas._accounts) {
                if (window._gas._accounts[i] == sub[0]) {
                    // Repeated account
                    if (acct_name === undefined) {
                        return 1;
                    }
                }
            }
            acct_name = acct_name || '_gas' +
                String(window._gas._accounts_length + 1);
            // Force that the first unamed account is _gas1
            if (typeof window._gas._accounts['_gas1'] == 'undefined' &&
                sindexOf.call(acct_name, '_gas') != -1) {
                acct_name = '_gas1';
            }
            window._gas._accounts[acct_name] = sub[0];
            window._gas._accounts_length += 1;
            acct_name = _build_acct_name(acct_name);
            return _gaq_push([acct_name + foo, sub[0]]);
        }

        // Intercept _linka and _linkByPost
        if (foo === '_link' || foo === '_linkByPost') {
            args = slice.call(sub);
            args.unshift(foo);
            return _gaq_push(args);
        }

        // If user provides account than trigger event for just that account.
        var acc_foo;
        if (acct_name && window._gas._accounts[acct_name]) {
            acc_foo = _build_acct_name(acct_name) + foo;
            args = slice.call(sub);
            args.unshift(acc_foo);
            return _gaq_push(args);
        }

        // Call Original _gaq, for all accounts
        var return_val = 0;
        for (i in window._gas._accounts) {
            if (hasOwn.call(window._gas._accounts, i)) {
                acc_foo = _build_acct_name(i) + foo;
                args = slice.call(sub);
                args.unshift(acc_foo);
                return_val += _gaq_push(args);
            }
        }
        return return_val ? 1 : 0;
    }
};

/**
 * Standard method to execute GA commands.
 *
 * Everything pushed to _gas is in fact pushed back to _gaq. So Helpers are
 * ready for hooks. This creates _gaq as a series of functions that call
 * _gas._execute() with the same arguments.
 */
window._gas.push = function() {
    var args = slice.call(arguments);
    for (var i = 0; i < args.length; i++) {
        (function(arr) {
            _gaq.push(function() {
                window._gas._execute.call(window._gas.gh, arr);
            });
        })(args[i]);
    }
};

/**
 * Hook for _trackExceptions
 *
 * Watchout for circular calls
 */
window._gas.push(['_addHook', '_trackException', function(exception, message) {
    window._gas.push(['_trackEvent',
        'Exception ' + (exception.name || 'Error'),
        message || exception.message || exception,
        url
    ]);
    return false;
}]);

/**
 * Hook to enable Debug Mode
 */
window._gas.push(['_addHook', '_setDebug', function(set_debug) {
    window._gas.debug_mode = !!set_debug;
}]);

/**
 * Hook to Remove other Hooks
 *
 * It will remove the last inserted hook from a _gas function.
 *
 * @param {string} func _gas Function Name to remove Hooks from.
 * @return {boolean} Always returns false.
 */
window._gas.push(['_addHook', '_popHook', function(func) {
    var arr = window._gas._hooks[func];
    if (arr && arr.pop) {
        arr.pop();
    }
    return false;
}]);

/**
 * Hook to set the default tracker.
 *
 * The default tracker is the nameless tracker that is pushed into _gaq_push
 */
window._gas.push(['_addHook', '_setDefaultTracker', function(tname) {
    window._gas._default_tracker = tname;
}]);
/*!
 * GAS - Google Analytics on Steroids
 * Helper Functions
 *
 * Copyright 2011, Direct Performance
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */

var gas_helpers = {};

/**
 * Returns true if the element is foun in the Array, false otherwise.
 *
 * @param {Array} obj Array to search at.
 * @param {object} item Item to search form.
 * @return {boolean} true if contains.
 */
gas_helpers['inArray'] = function(obj, item) {
    if (obj && obj.length) {
        for (var i = 0; i < obj.length; i++) {
            if (obj[i] === item) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Checks if the object is an Array
 *
 * @param {object} obj Object to check.
 * @return {boolean} true if the object is an Array.
 */
gas_helpers['isArray'] = function(obj) {
    return toString.call(obj) === '[object Array]';
};

/**
 * Removes special characters and Lowercase String
 *
 * @param {string} str to be sanitized.
 * @param {boolean} strict_opt If we should remove any non ascii char.
 * @return {string} Sanitized string.
 */
gas_helpers['_sanitizeString'] = function(str, strict_opt) {
    str = str.toLowerCase()
        .replace(/^\ +/, '')
        .replace(/\ +$/, '')
        .replace(/\s+/g, '_')
        .replace(/[áàâãåäæª]/g, 'a')
        .replace(/[éèêëЄ€]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôõöøº]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/[ç¢©]/g, 'c');

    if (strict_opt) {
        str = str.replace(/[^a-z0-9_-]/g, '_');
    }
    return str.replace(/_+/g, '_');
};

/**
 * Cross Browser helper to addEventListener.
 *
 * ga_next.js currently have a _addEventListener directive. So _gas will
 * allways prefer that if available, and will use this one only as a fallback
 *
 * @param {HTMLElement} obj The Element to attach event to.
 * @param {string} evt The event that will trigger the binded function.
 * @param {function(event)} ofnc The function to bind to the element.
 * @param {boolean} bubble true if event should be fired at bubble phase.
 * Defaults to false. Works only on W3C compliant browser. MSFT don't support
 * it.
 * @return {boolean} true if it was successfuly binded.
 */
gas_helpers['_addEventListener'] = function(obj, evt, ofnc, bubble) {
    var fnc = function(event) {
        event = event || window.event;
        return ofnc.call(obj, event);
    };
    // W3C model
    if (bubble === undefined) {
        bubble = false;
    }
    if (obj.addEventListener) {
        obj.addEventListener(evt, fnc, !!bubble);
        return true;
    }
    // Microsoft model
    else if (obj.attachEvent) {
        return obj.attachEvent('on' + evt, fnc);
    }
    // Browser don't support W3C or MSFT model, time to go old school
    else {
        evt = 'on' + evt;
        if (typeof obj[evt] === 'function') {
            // Object already has a function on traditional
            // Let's wrap it with our own function inside another function
            fnc = (function(f1, f2) {
                return function() {
                    f1.apply(this, arguments);
                    f2.apply(this, arguments);
                }
            })(obj[evt], fnc);
        }
        obj[evt] = fnc;
        return true;
    }
};

// This function is the first one pushed to _gas, so it creates the _gas.gh
//     object. It needs to be pushed into _gaq so that _gat is available when
//     it runs.
window._gas.push(function() {
    var tracker = _gat._getTrackerByName();

    // Extend helpers with the tracker;
    gas_helpers.tracker = tracker;

    window._gas.gh = gas_helpers;

});

/**
 * Enables setting of page Title on _trackPageview.
 *
 * This Hook cancels the execution of the current pageview and fires a new one.
 * for this reason this hook must be inserted early on the hook list,
 * so other hooks don't fire twice.
 */
window._gas.push(['_addHook', '_trackPageview', function(url, title) {
    if (title && typeof title === 'string') {
        var oTitle = document.title;
        window._gas.push(
            function() {document.title = title;},
            ['_trackPageview', url],
            function() {document.title = oTitle;}
        );
        return false;
    }
    return [url];
}]);

/*!
 * GAS - Google Analytics on Steroids
 * Download Tracking plugin
 *
 * Copyright 2011, Direct Performance
 * Copyright 2011, Cardinal Path
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */

function _trackDownloads(extensions) {

}

/**
 * TODO: Write doc
 *
 * @param {string|Array} extensions additional file extensions to track as
 * downloads.
 */
window._gas.push(['_addHook', '_trackDownloads', function(extensions) {
    var ext = 'xls,xlsx,doc,docx,ppt,pptx,pdf,txt,zip';
    ext += ',rar,7z,exe,wma,mov,avi,wmv,mp3';
    ext = ext.split(',');
    if (typeof extensions === 'string') {
        ext = ext.concat(extensions.split(','));
    }else if (this.isArray(extensions)) {
        ext = ext.concat(extensions);
    }
    return _trackDownloads(ext);
}]);

/**
 * Hook to sanity check trackEvents
 *
 * The value is rounded and parsed to integer.
 * Negative values are sent as zero.
 * If val is NaN than it is sent as zero.
 */
window._gas.push(['_addHook', '_trackEvent', function(cat, act, lab, val) {
    if (val) {
        val = (val < 0 ? 0 : Math.round(val)) || 0;
    }
    return [cat, act, lab, val];
}]);

/*!
 * GAS - Google Analytics on Steroids
 * Form Tracking Plugin
 *
 * Copyright 2011, Direct Performance
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */
function track_form(form, opt_live) {
    var scp = this;
    if (opt_live === undefined) {
        opt_live = false;
    }

    function tag_element(e) {
        var el = e.target || this;
        var el_name = el.name || el.id || el.type;
        var action_name = e.type;
        var form_name = form.name || form.id;

        form_name = form_name ? ' (' + form_name + ')' : '';

        _gas.push(['_trackEvent',
            'Form Tracking', //category
            'form' + form_name, //action
            el_name + ' (' + action_name + ')' //label
        ]);
    }


    if (opt_live) {
        scp._addEventListener(document.body, 'click', function(e) {
            try {
                var el = e.target;
                if (e.type == 'click' &&
                  scp.inArray(['button', 'submit', 'image', 'reset'],
                    el.type.toLowerCase()
                  )
                ) {

                    tag_element(e);
                }
            }catch (e) {} //Ignore errors here.
        });
        scp._addEventListener(document.body, 'change', function(e) {
            try {
                var el = e.target;
                if (e.type == 'change' &&
                  scp.inArray(['input', 'select', 'textarea', 'hidden'],
                    el.nodeName.toLowerCase()
                  )
                ) {

                    tag_element(e);
                }
            }catch (e) {} //Ignore errors here.
        });
    }else {
        var i, el;
        if (!form.elements || !form.elements.length) {
            return false;
        }
        for (i = 0; i < form.elements.length; i++) {
            el = form.elements[i];
            if (scp.inArray(['button', 'submit', 'image', 'reset'], el.type)) {
                //Button
                scp._addEventListener(el, 'click', tag_element);
            }
            else {
                //Text field
                scp._addEventListener(el, 'change', tag_element);
            }
        }
        scp._addEventListener(form, 'submit', tag_element);
    }
}

/**
 * Triggers the execution
 *
 * @param {boolean} opt_live Either it should use live or not. Default to false.
 */
window._gas.push(['_addHook', '_trackForms', function(opt_live) {
    var scp = this;
    for (var i = 0; i < document.forms.length; i++) {
        try {
            // I'm not sure why it sometimes fails at Fx4 and ie8
            //FIXME: Fail with type error since it cant found the helpers on
            // 'this' object.
            track_form.call(scp, document.forms[i], opt_live);
        }catch (e) {}
        if (opt_live) break;
    }
    return false;
}]);

/*!
 * GAS - Google Analytics on Steroids
 * Max Scroll Tracking Plugin
 *
 * Copyright 2011, Direct Performance
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * Based on http://www.howtocreate.co.uk/tutorials/javascript/browserwindow
 *
 * $Date$
 */

/**
 * Get current windows width and heigtht
 *
 * @return {Array.<number>} [width,height].
 */
function get_window_size() {
    var myWidth = 0, myHeight = 0;
    if (typeof(window.innerWidth) == 'number') {
        //Non-IE
        myWidth = window.innerWidth;
        myHeight = window.innerHeight;
    } else if (
        document.documentElement &&
        (
            document.documentElement.clientWidth ||
            document.documentElement.clientHeight
        )
    ) {
        //IE 6+ in 'standards compliant mode'
        myWidth = document.documentElement.clientWidth;
        myHeight = document.documentElement.clientHeight;
    } else if (
        document.body &&
        (
            document.body.clientWidth ||
            document.body.clientHeight
        )
    ) {
        //IE 4 compatible
        myWidth = document.body.clientWidth;
        myHeight = document.body.clientHeight;
    }

    return [myWidth, myHeight];
}

/**
 * Get current absolute window scroll position
 *
 * @return {Array.<number>} [XScroll,YScroll].
 */
function get_window_scroll() {
    var scrOfX = 0, scrOfY = 0;
    if (typeof(window.pageYOffset) == 'number') {
        //Netscape compliant
        scrOfY = window.pageYOffset;
        scrOfX = window.pageXOffset;
    } else if (
        document.body &&
        (
            document.body.scrollLeft ||
            document.body.scrollTop
        )
    ) {
        //DOM compliant
        scrOfY = document.body.scrollTop;
        scrOfX = document.body.scrollLeft;
    } else if (
        document.documentElement &&
        (
            document.documentElement.scrollLeft ||
            document.documentElement.scrollTop
        )
    ) {
        //IE6 standards compliant mode
        scrOfY = document.documentElement.scrollTop;
        scrOfX = document.documentElement.scrollLeft;
    }
    return [scrOfX, scrOfY];
}

/**
 * Get current absolute document height
 *
 * @return {number} Current document height.
 */
function get_doc_height() {
    var D = document;
    return Math.max(
        Math.max(D.body.scrollHeight, D.documentElement.scrollHeight),
        Math.max(D.body.offsetHeight, D.documentElement.offsetHeight),
        Math.max(D.body.clientHeight, D.documentElement.clientHeight)
    );
}


/**
 * Get current vertical scroll percentage
 *
 * @return {number} Current vertical scroll percentage.
 */
function get_scroll_percentage() {
    return ((
        get_window_scroll()[1] +
        get_window_size()[1]

    ) / (
        get_doc_height()
    )) * 100;
}

var t = null;
var max_scroll = 0;
function update_scroll_percentage(now) {
    if (t) {
        clearTimeout(t);
    }
    if (now === true) {
        max_scroll = Math.max(get_scroll_percentage(), max_scroll);
        return;
    }
    t = setTimeout(function() {
        max_scroll = Math.max(get_scroll_percentage(), max_scroll);
    }, 400);
}


function track_max_scroll() {
    this._addEventListener(window, 'beforeunload', function() {
        update_scroll_percentage(true);
        var bucket = Math.floor(max_scroll / 10) * 10;
        if (bucket < 100) {
            var bucket = String(bucket) + '-' + String(bucket + 9);
        }

        _gas.push(['_trackEvent',
            'Max Scroll',
            url,
            String(bucket),
            Math.round(max_scroll),
            true // non-interactive
        ]);
    });

}

window._gas.push(['_addHook', '_trackMaxSrcoll', function() {
    this._addEventListener(window, 'scroll', update_scroll_percentage);
    track_max_scroll.call(this);
}]);

/*!
 * GAS - Google Analytics on Steroids
 * Multi-Domain Tracking Plugin
 *
 * Copyright 2011, Direct Performance
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */

/**
 * Private variable to store allowAnchor choice
 */
window._gas._allowAnchor = false;

/**
 * _setAllowAnchor Hook to store choice for easier use of Anchor
 *
 * This stored value is used on _getLinkerUrl, _link and _linkByPost so it's
 * used the same by default
 */
window._gas.push(['_addHook', '_setAllowAnchor', function(val) {
    _gas._allowAnchor = val;
}]);

/**
 * _link Hook to use stored allowAnchor value.
 */
window._gas.push(['_addHook', '_link', function(url, use_anchor) {
    if (use_anchor === undefined) {
        use_anchor = _gas._allowAnchor;
    }
    return [url, use_anchor];
}]);

/**
 * _linkByPost Hook to use stored allowAnchor value.
 */
window._gas.push(['_addHook', '_linkByPost', function(url, use_anchor) {
    if (use_anchor === undefined) {
        use_anchor = _gas._allowAnchor;
    }
    return [url, use_anchor];
}]);

/**
 * Store all domains pushed by _setDomainName that don't match current domain.
 *
 * @type {Array.<string>}
 */
var _external_domains = [];

/**
 * Store the internal domain name
 *
 * @type string
 */
var _internal_domain = undefined;

/**
 * _setDomainName Hook to add pushed domains to _external_domains if it doesn't
 * match current domain.
 *
 * This Hook let you call _setDomainName multiple times. So _gas will only
 * apply the one that matches the current domain and the other ones will be
 * used to track external domains with cookie data.
 */
_gas.push(['_addHook', '_setDomainName', function(domainName) {
    if (sindexOf.call(document.location.hostname, domainName) < 0) {
        _external_domains.push(domainName);
        return false;
    }
    _internal_domain = domainName;
}]);

/**
 * _addExternalDomainName Hook.
 *
 * This hook let you add external domains so that urls on current page to this
 * domain are marked to send cookies.
 * You should use _setDomainName for this in most of the cases.
 */
_gas.push(['_addHook', '_addExternalDomainName', function(domainName) {
    _external_domains.push(domainName);
    return false;
}]);

/**
 * Function to mark links on the current pages to send links
 *
 * This function is used to make it easy to implement multi-domain-tracking.
 * @param {string} event_used Should be 'now', 'click' or 'mousedown'. Default
 * 'click'.
 * @this _gas.gh GAS Helper functions
 * @return {boolean} Returns false to avoid this is puhed to _gaq.
 */
function track_links(event_used) {
    var internal = document.location.hostname,
        gh = this,
        i, j, el;
    if (event_used !== 'now' && event_used !== 'mousedown') {
        event_used = 'click';
    }
    for (i = 0; i < document.links.length; i++) {
        el = document.links[i];
        if (sindexOf.call(el.href, 'http') == 0) {
            // Check to see if it's a internal link
            if (el.hostname == internal ||
              sindexOf.call(el.hostname, _internal_domain) >= 0) {
                continue;
            }
            // Tag external Links either now or on mouse event.
            for (j = 0; j < _external_domains.length; j++) {
                if (sindexOf.call(el.hostname, _external_domains[j]) >= 0) {
                    if (event_used === 'now') {
                        el.href = gh.tracker._getLinkerUrl(
                            el.href,
                            _gas._allowAnchor
                        );
                    }else {
                        if (event_used === 'click') {
                            this._addEventListener(el, event_used, function(e) {
                                _gas.push(
                                    ['_link', this.href, _gas._allowAnchor]
                                );
                                if (e.preventDefault)
                                    e.preventDefault();
                                else
                                    e.returnValue = false;
                            });
                        }else {
                            this._addEventListener(el, event_used, function() {
                                this.href = gh.tracker._getLinkerUrl(
                                    this.href,
                                    _gas._allowAnchor
                                );
                            });
                        }
                    }
                }
            }
        }
    }
    return false;
}

/**
 * Registers Hook to _setMultiDomain
 */
_gas.push(['_addHook', '_setMultiDomain', track_links]);

/**
 * Enable Multidomain Tracking.
 *
 * It will look for all links inside the page that matches one of the
 * _external_domains and will mark that link to be tagged
 */
//_gas.push(['_setMultiDomain', 'mousedown']);
/*!
 * GAS - Google Analytics on Steroids
 * Outbound Link Tracking plugin
 *
 * Copyright 2011, Direct Performance
 * Copyright 2011, Cardinal Path
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */
function _trackOutboundLinks() {
    var links = document.links;
    for (var i = 0; i < links.length; i++) {
        if (
            sindexOf.call(links[i].href, 'http') == 0 &&
            sindexOf.call(links[i].href, document.location.host) < 0
       ) {
            this._addEventListener(
                links[i],
                'mousedown',
                (function(l) {
                    return function() {
                        var h = l.href.substring(
                            sindexOf.call(l.href, '//') + 2
                        );
                        var i = sindexOf.call(h, '/') > -1 ?
                            sindexOf.call(h, '/') : undefined;
                        var j = sindexOf.call(h, '__utma') > -1 ?
                            sindexOf.call(h, '__utma') : undefined;
                        _gaq.push(['_trackEvent',
                            'Outbound',
                            h.substring(0, i),
                            h.substring(i, j) || '',
                            0,
                            true //non-interactive
                        ]);
                    }
                })(links[i])
            );
        }
    }
}

window._gas.push(['_addHook', '_trackOutboundLinks', function() {
    _trackOutboundLinks.call(this);
}]);

/*!
 * GAS - Google Analytics on Steroids
 * Vimeo Video Tracking plugin
 *
 * Copyright 2011, Cardinal Path
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */


function _vimeoPostMessage(method, params, target) {
    if (!target.contentWindow.postMessage) {
        return false;
    }
    var url = target.getAttribute('src').split('?')[0],
        data = JSON.stringify({
            method: method,
            value: params
        });
    target.contentWindow.postMessage(data, url);
}

var _vimeo_urls = {};
var _has_vimeo_window_event = false;
function _trackVimeo(force) {
    var iframes = document.getElementsByTagName('iframe');
    var vimeo_videos = 0;
    var player_id;
    var player_src;
    var separator;
    for (var i = 0; i < iframes.length; i++) {
        if (sindexOf.call(iframes[i].src, '//player.vimeo.com') > -1) {
            player_id = 'gas_vimeo_' + i;
            player_src = iframes[i].src;
            separator = '?';
            if (sindexOf.call(player_src, '?') > -1) {
                separator = '&';
            }
            if (sindexOf.call(player_src, 'api=1') < 0) {
                if (force) {
                    // Reload the video enabling the api
                    player_src += separator + 'api=1&player_id=' + player_id;
                }else {
                    // We won't track players that don't have api enabled.
                    break;
                }
            }else {
                if (sindexOf.call(player_src, 'player_id=') < -1) {
                    player_src += separator + 'player_id=' + player_id;
                }
            }
            vimeo_videos++;
            iframes[i].id = player_id;
            if (iframes[i].src !== player_src) {
                iframes[i].src = player_src;
                break; // break to wait until it is ready since we reloaded it.
            }
            // We need to cache the video url since vimeo won't provide it
            // in the event
            _vimeoPostMessage('getVideoUrl', '', iframes[i]);
            _vimeoPostMessage('addEventListener', 'play', iframes[i]);
            _vimeoPostMessage('addEventListener', 'pause', iframes[i]);
            _vimeoPostMessage('addEventListener', 'finish', iframes[i]);
        }
    }
    if (vimeo_videos > 0 && _has_vimeo_window_event === false) {
        this._addEventListener(window, 'message', function(event) {
            if (sindexOf.call(event.origin, '//player.vimeo.com') > -1) {
                var data = JSON.parse(event.data);
                if (data.event === 'ready') {
                    _trackVimeo(); // Force rerun since a player is ready
                }else if (data.method) {
                    if (data.method == 'getVideoUrl') {
                        _vimeo_urls[data.player_id] = data.value;
                    }
                } else {
                    _gas.push(['_trackEvent', 'Vimeo Video',
                        data.event, _vimeo_urls[data.player_id]]);
                }
            }

        }, false);
        _has_vimeo_window_event = true;
    }
}

window._gas.push(['_addHook', '_trackVimeo', function(force) {
    _trackVimeo.call(this, force);
    return false;
}]);

/*!
 * GAS - Google Analytics on Steroids
 * YouTube embedded Video Tracking plugin
 *
 *
 * Copyright 2011, Cardinal Path
 * Licensed under the MIT license.
 *
 * @author Eduardo Cereto <eduardocereto@gmail.com>
 * @version $Revision$
 *
 * $Date$
 */

function _ytStateChange(event) {
    var action = '';
    switch (event.data) {
        case YT.PlayerState.ENDED:
            action = 'finish';
            break;
        case YT.PlayerState.PLAYING:
            action = 'play';
            break;
        case YT.PlayerState.PAUSED:
            action = 'pause';
            break;
    }
    if (action) {
        _gas.push(['_trackEvent',
            'YouTube Video', action, event.target.getVideoUrl()
        ]);
    }
}

function _ytError(event) {
    _gas.push(['_trackEvent', 'YouTube Video', 'error', event.data]);
}

function _trackYoutube(force) {
    var youtube_videos = [];
    var iframes = document.getElementsByTagName('iframe');
    for (var i = 0; i < iframes.length; i++) {
        if (sindexOf.call(iframes[i].src, '//www.youtube.com/embed') > -1) {
            if (sindexOf.call(iframes[i].src, 'enablejsapi=1') < 0) {
                if (force) {
                    // Reload the video enabling the api
                    if (sindexOf.call(iframes[i].src, '?') < 0) {
                        iframes[i].src += '?enablejsapi=1';
                    }else {
                        iframes[i].src += '&enablejsapi=1';
                    }
                }else {
                    // We can't track players that don't have api enabled.
                    break;
                }
            }
            youtube_videos.push(iframes[i]);
        }
    }
    if (youtube_videos.length > 0) {
        // this function will be called when the youtube api loads
        window.onYouTubePlayerAPIReady = function() {
            var p;
            for (var i = 0; i < youtube_videos.length; i++) {
                p = new YT.Player(youtube_videos[i]);
                p.addEventListener('onStateChange', _ytStateChange);
                p.addEventListener('onError', _ytError);
            }
        };
        // load the youtube player api
        var tag = document.createElement('script');
        tag.src = 'http://www.youtube.com/player_api';
        tag.type = 'text/javascript';
        tag.async = true;
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
}

window._gas.push(['_addHook', '_trackYoutube', function(force) {
    _trackYoutube.call(this, force);
    return false;
}]);

/*!
 * Wrap-up
 */
// Execute previous functions
while (window._gas._queue.length > 0) {
    window._gas.push(window._gas._queue.shift());
}

// Import ga.js
if (_gaq && _gaq.length >= 0) {
    (function() {
        var ga = document.createElement('script');
        ga.type = 'text/javascript';
        ga.async = true;
        ga.src = (
            'https:' == document.location.protocol ?
                'https://ssl' :
                'http://www'
        ) +
            '.google-analytics.com/ga.js';
        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(ga, s);
    })();
}

})(window);
