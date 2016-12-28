/**
 * @overview Framework of the Client-side Component Model (<i>ccm</i>)
 * @author André Kless <andre.kless@web.de> 2014-2016
 * @copyright Copyright (c) 2014-2016 André Kless
 * @license
 * The MIT License (MIT)
 * Copyright (c) 2014-2016 André Kless
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * @version latest (8.0.0)
 * @changes
 * version 8.0.0 (31.12.2016):
 * - no more jQuery dependency
 * - outsource not framework relevant helper functions for component developer
 * - updates for every part of the framework
 * - support of Shadow DOM for the website area of ccm instances
 * - support of different versions of the ccm framework in the same website
 * version 7.4.0 (25.11.2016):
 * - ccm.helper.dataset gives information if resulting dataset is a new dataset
 * - ccm.helper.privatize privatizes all possible members as default
 * version 7.3.0 (11.11.2016):
 * - ccm.helper.dataset accept ccm datastore directly
 * - ccm.helper.dataset return new dataset without creation in datastore if dataset not exists
 * version 7.2.1 (07.11.2016):
 * - instances keeps reference to their individual original component object
 * version 7.2.0 (06.11.2016):
 * - bugfix in polyfill url
 * - change way to detect if ccm custom element is in the DOM
 * - no changeable default instance configuration for a registered unique component object
 * - consider given default for default instance configuration when using ccm.component dependencies
 * - update helper method 'catchComponentTags'
 * - bugfix for catching inner tags of a ccm custom element
 * version 7.1.2 (03.11.2016):
 * - use of attachedCallback instead of createdCallback for ccm custom elements
 * version 7.1.1 (03.11.2016):
 * - bugfix for ccm.helper.catchComponentTags
 * version 7.1.0 (03.11.2016):
 * - no interpretation of a ccm custom element if its outside the DOM
 * - add helper method 'ccm.helper.catchComponentTags'
 * version 7.0.0 (02.11.2016):
 * - update of ccm.component
 * - new implementation of ccm custom elements (incompatible change)
 * - add helper method 'ccm.helper.isNode'
 * - prevent deeper recursion for HTML DOM nodes
 * (for older version changes see ccm-6.14.2.js)
 */

// no custom elements support? => load polyfill  // TODO: update polyfill
if ( !( 'registerElement' in document ) ) {
  document.write( '<script src="https://cdnjs.cloudflare.com/ajax/libs/document-register-element/0.5.3/document-register-element.js"><\/script>' );
  document.write( '<script src="https://cdnjs.cloudflare.com/ajax/libs/webcomponentsjs/0.7.22/webcomponents-lite.min.js"><\/script>' );
}

// set keyframe for ccm loading icon animation
if ( document.body ) {
  window.ccm = document.createElement( 'style' );
  window.ccm.appendChild( document.createTextNode( '@keyframes ccm_loading { to { transform: rotate(360deg); } }' ) );
  document.head.appendChild( window.ccm );
}
else document.write( '<style>@keyframes ccm_loading { to { transform: rotate(360deg); } }</style>' );

/**
 * <i>ccm</i> namespace
 * @global
 * @namespace
 */
var ccm = function () {

  /*---------------------------------------------- private ccm members -----------------------------------------------*/

  /**
   * @summary loaded <i>ccm</i> components
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.index, ccm.types.component>}
   */
  var components = {};

  /**
   * @summary <i>ccm</i> database in IndexedDB
   * @memberOf ccm
   * @private
   * @type {object}
   */
  var db;

  /**
   * @summary already loaded resources
   * @memberOf ccm
   * @private
   * @type {object}
   */
  var resources = {};

  /**
   * @summary created <i>ccm</i> datastores
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.source, ccm.Datastore>}
   */
  var stores = {};

  /**
   * @summary waitlist with actions that wait for currently loading resources
   * @memberOf ccm
   * @private
   * @type {Object.<string, ccm.types.action[]>}
   */
  var waiter = {};

  /*---------------------------------------------- private ccm classes -----------------------------------------------*/

  /**
   * @summary constructor for creating <i>ccm</i> datastores
   * @description See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management} for general informations about <i>ccm</i> data management.
   * @memberOf ccm
   * @private
   * @class
   * @example
   * // Example for a <i>ccm</i> datastore instance:
   * {
   *   get: function ( key_or_query, callback ) {...},
   *   set: function ( priodata, callback ) {...},
   *   del: function ( key, callback ) {...},
   *   source: function () {...}
   * }
   */
  var Datastore = function () {

    /*-------------------------------------------- ccm datastore members ---------------------------------------------*/

    /**
     * @summary websocket communication callbacks
     * @private
     * @type {function[]}
     */
    var callbacks = [];

    /**
     * @summary contains privatized members
     * @private
     * @type {object}
     */
    var my;

    /*----------------------------------------- public ccm datastore methods -----------------------------------------*/

    /**
     * @summary initialize datastore
     * @description
     * When datastore is created and after the initialization of an <i>ccm</i> instance in case of
     * this datastore is provided via a <i>ccm</i> dependency of that <i>ccm</i> instance.
     * This method will be removed by <i>ccm</i> after the one-time call.
     * @param {function} callback - when this datastore is initialized
     */
    this.init = function ( callback ) {

      // privatize security relevant members
      my = ccm.helper.privatize( this, 'source', 'local', 'store', 'url', 'db', 'socket', 'onChange', 'user' );

      // set getter method for ccm datastore source
      this.source = function () { return my.source; };

      // is realtime datastore? => set server notification callback
      if ( my.socket ) my.socket.onmessage = function ( message ) {

        // parse server message to JSON
        message = JSON.parse( message.data );

        // own request? => perform callback
        if ( message.callback ) callbacks[ message.callback - 1 ]( message.data );

        // notification about changed data from other client?
        else {

          // change data locally
          var dataset = ccm.helper.isObject( message ) ? updateLocal( message ) : delLocal( message );

          // perform change callback
          if ( my.onChange ) my.onChange( dataset );

        }

      };

      // perform callback
      if ( callback ) callback();

    };

    /**
     * @summary get one or more stored datasets
     * @description
     * There are two ways to use this method depending on the first parameter.
     * The first way is to get a single dataset with a given key.
     * The second way is to get all datasets that matches a given query.
     * With no first parameter the method provides an array with all stored datasets.
     * In this case the callback could be the first parameter directly.
     * Getting all stored datasets counts as a query and don't work if the chosen data level not supports queries.
     * If a query is used and data is managed via server-side database (data level 3), than the resulting datasets never come from local cache..
     * See [table of supported operations]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#supported-operations} to check this.
     * If the wanted data is completely local cached via <i>ccm</i> and is not containing data dependencies to external sources, than the data could be received as return value.
     * Data dependencies inside the requested data will be automatically resolved via <i>ccm</i> (see last example).
     * For more informations about [data dependencies]{@link ccm.dataset} see the given link.
     * @param {ccm.types.key|object} [key_or_query] - unique key of the dataset or alternative a query
     * @param {ccm.types.getResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset|ccm.types.dataset[]} requested dataset(s) (only if no inner operation is asynchron)
     * @example
     * // get array of all stored datasets
     * store.get( function ( result ) {
     *   console.log( result );                  // [ { key: ..., ... }, ... ]
     * } );
     * @example
     * // get single dataset with unique key 'test'
     * store.get( 'test', function ( result ) {
     *   console.log( result );                  // { key: 'test', ... }
     * } );
     * @example
     * // get single dataset with unique key 4711
     * store.get( 4711, function ( result ) {
     *   console.log( result );                  // { key: 4711, ... }
     * } );
     * @example
     * // get array of all stored datasets that match the given query
     * store.get( {
     *   author: 'akless',        // This query selects all datasets that have a property 'author'
     *   year: 2015               // with value 'akless' and a property 'year' with value '2015'.
     * }, function ( result ) {
     *   console.log( result );   // [ { key: ..., author: 'akless', year: 2015, ... }, ... ]
     * } );
     * @example
     * // get array of all stored datasets as return value (only if no inner operation is asynchron)
     * var result = store.get();
     * console.log( result );
     * @example
     * // get single dataset that contains a data dependency
     * store.set( {                                                   // Store a dataset
     *   key:   'test',                                               // that contains a
     *   other: [ 'ccm.dataset', { url: ..., store: ... }, 'test2' ]  // data dependency
     * } );                                                           // and than request it.
     * var result = store.get( 'test' );
     * console.log( result );             // { key: 'test', other: { key: 'test2', ... } }
     */
    this.get = function ( key_or_query, callback ) {

      // allow skipping of first parameter
      if ( typeof key_or_query === 'function' ) { callback = key_or_query; key_or_query = undefined; }

      // dataset key is undefined? => use empty object (to select all datasets as default)
      if ( key_or_query === undefined ) key_or_query = {};

      // check data source
      if ( my.url   ) return serverDB();    // server-side database
      if ( my.store ) return clientDB();    // client-side database
      if ( my.local ) return localCache();  // local cache

      /**
       * get dataset(s) from local cache
       * @returns {ccm.types.dataset}
       */
      function localCache() {

        return getLocal( key_or_query, callback );

      }

      /**
       * get dataset(s) from client-side database
       */
      function clientDB() {

        /**
         * local cached dataset
         * @type {ccm.types.dataset}
         */
        var dataset = checkLocal();

        // is dataset local cached? => return local cached dataset
        if ( dataset ) return dataset;

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for getting dataset
         * @type {object}
         */
        var request = store.get( key_or_query );

        // set success callback
        request.onsuccess = function ( evt ) {

          // no callback? => abort
          if ( !callback ) return;

          /**
           * result dataset
           * @type {ccm.types.dataset}
           */
          var dataset = evt.target.result;

          // result is not a ccm dataset? => perform callback with null
          if ( !ccm.helper.isDataset( dataset ) ) callback( null );

          // set result dataset in local cache
          setLocal( dataset );

          // perform callback with result dataset
          if ( callback ) callback( dataset || null );

        };

      }

      /**
       * get dataset(s) from server-side database
       */
      function serverDB() {

        // get dataset by key?
        if ( !ccm.helper.isObject( key_or_query ) ) {

          /**
           * local cached dataset
           * @type {ccm.types.dataset}
           */
          var dataset = checkLocal();

          // is dataset local cached? => return local cached dataset
          if ( dataset ) return dataset;

        }

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { key: key_or_query } );

        // load dataset from server interface
        if ( my.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {*} response
         */
        function onResponse( response ) {

          // set result dataset(s) in local cache
          if ( ccm.helper.isDataset( response ) )
            setLocal( response );
          else if ( Array.isArray( response ) )
            response.map( setLocal );

          // perform callback with server response
          if ( callback ) callback( response || null );

        }

      }

      /**
       * check if dataset is local cached
       * @returns {ccm.types.dataset}
       */
      function checkLocal() {

        /**
         * local cached dataset
         * @type {ccm.types.dataset}
         */
        var dataset = getLocal( key_or_query );

        // is dataset local cached? => perform callback with local cached dataset
        if ( dataset && callback ) callback( dataset );

        // return local cached dataset
        return dataset;

      }

    };

    /**
     * @summary create or update a dataset
     * @description
     * If the given priority data has no key property, than the priority data will be set as a new dataset with a generated key.
     * If the given priority data contains a value for the key property and a dataset with that given key already exists in the datastore, than that dataset will be updated with the given priority data.
     * If no dataset with that given key exists, than the priority data will be set as a new dataset with the given key.
     * For more informations about [priority data]{@link ccm.helper.integrate} or [automatic generation of unique keys]{@link ccm.helper.generateKey} see the given links.
     * Partial updates of deeper properties with dot notation (see last example) don't works if the chosen data level not supports deep partial updates.
     * See [table of supported operations]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#supported-operations} to check this.
     * The resulting created or updated dataset will be provided via callback.
     * If the dataset is only managed via local cache, than the results could be received via return value.
     * If priodata contains a not valid ccm dataset key, than the result is <code>null</code>.
     * @param {ccm.types.dataset} priodata - priority data
     * @param {ccm.types.setResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset} created or updated dataset (only if no inner operation is asynchron)
     * @example
     * // store a new dataset with a automatic generated unique key
     * store.set( {
     *   question: 'my question',           // The priority data don't
     *   answers: [ 'answer1', 'answer2' ]  // contains a property 'key'.
     * }, function ( result ) {
     *   console.log( result );   // { key: 1465718723761X7117581531745409, question: ..., answers: ... }
     * } );
     * @example
     * // create a new dataset with unique key 'test'
     * store.set( {
     *   key: 'test',             // Creates a new dataset if a dataset with unique key 'test' already exists
     *   value: 'foo'             // in the datastore. Otherwise the existing dataset will be updated.
     * }, function ( result ) {
     *   console.log( result );   // { key: 'test', value: 'foo' } or { key: 'test', value: 'foo', ... }
     * } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var result = store.set( { key: 'test', value: 'foo' } );
     * console.log( result );
     * @example
     * // updates a deeper property of a stored dataset
     * store.set( {
     *   key: 'test',
     *   'feedback.user.comment': 'My comment'
     * }, function ( result ) {
     *   console.log( result );   // { key: 'test', feedback: { user: { comment: 'My comment', ... }, ... }, ... }
     * } );
     */
    this.set = function ( priodata, callback ) {

      // clone priority data
      priodata = ccm.helper.clone( priodata );

      // priority data has no key? => generate unique key
      if ( !priodata.key ) priodata.key = ccm.helper.generateKey();

      // priority data does not contains a valid ccm dataset key? => abort and perform callback without a result
      if ( !ccm.helper.regex( 'key' ).test( priodata.key ) ) {
        if ( callback ) callback( null );
        return null;
      }

      // choose data level
      if ( my.url   ) return serverDB();    // server-side database
      if ( my.store ) return clientDB();    // client-side database
      if ( my.local ) return localCache();  // local cache

      /**
       * set dataset in local cache
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function localCache() {

        return updateLocal( priodata, callback );

      }

      /**
       * set dataset in client-side database
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function clientDB() {

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for setting dataset
         * @type {object}
         */
        var request = store.put( priodata );

        // set success callback
        request.onsuccess = localCache;

      }

      /**
       * set dataset in server-side database
       * @returns {ccm.types.dataset} created or updated dataset
       */
      function serverDB() {

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { dataset: priodata } );

        // send priority data to server interface
        if ( my.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.types.dataset} dataset - created or updated dataset
         */
        function onResponse( dataset ) {

          // check server response
          if ( !checkResponse( dataset ) ) return;

          // set dataset in local cache
          priodata = dataset; localCache();

        }

      }

    };

    /**
     * @summary delete a stored dataset
     * @param {ccm.types.key} key - unique key of the dataset
     * @param {ccm.types.delResult} [callback] - when data operation is finished
     * @returns {ccm.types.dataset} deleted dataset (only if no inner operation is asynchron)
     * @example
     * // delete dataset with unique key 'test'
     * store.del( 'test', function ( result ) {
     *   console.log( result );                  // { key: 'test', ... }
     * } );
     * @example
     * // delete dataset with unique key 4711
     * store.del( 4711, function ( result ) {
     *   console.log( result );                  // { key: 4711, ... }
     * } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var result = store.del( 'test' );
     * console.log( result );
     */
    this.del = function ( key, callback ) {

      // check data source
      if ( my.url   ) return serverDB();    // server-side database
      if ( my.store ) return clientDB();    // client-side database
      if ( my.local ) return localCache();  // local cache

      /**
       * delete dataset in local cache
       * @returns {ccm.types.dataset} deleted dataset
       */
      function localCache() {

        return delLocal( key, callback );

      }

      /**
       * delete dataset in client-side database
       */
      function clientDB() {

        /**
         * object store from IndexedDB
         * @type {object}
         */
        var store = getStore();

        /**
         * request for deleting dataset
         * @type {object}
         */
        var request = store.delete( key );

        // set success callback
        request.onsuccess = localCache;

      }

      /**
       * delete dataset in server-side database
       */
      function serverDB() {

        /**
         * GET parameter
         * @type {object}
         */
        var data = prepareData( { del: key } );

        // send dataset key to server interface
        if ( my.socket ) useWebsocket( data, onResponse ); else useHttp( data, onResponse );

        /**
         * callback for server response
         * @param {ccm.types.dataset} dataset - deleted dataset
         */
        function onResponse( dataset ) {

          // check server response
          if ( !checkResponse( dataset ) ) return;

          // perform callback with deleted dataset
          if ( callback ) callback( dataset );

          // delete dataset in local cache
          callback = undefined; localCache();

        }

      }

    };

    /*---------------------------------------- private ccm datastore methods -----------------------------------------*/

    /**
     * @summary get dataset(s) from local cache
     * @private
     * @param {ccm.types.key|object} [key={}] - dataset key or query (default: all stored datasets)
     * @param {function} [callback] - callback (first parameter is result dataset)
     * @returns {ccm.types.dataset} result dataset (only if synchron)
     */
    function getLocal( key, callback ) {

      // dataset key is a query? => find dataset(s) by query
      if ( key === undefined || ccm.helper.isObject( key ) ) return find();

      /**
       * result dataset
       * @type {ccm.types.dataset}
       */
      var dataset = ccm.helper.clone( my.local[ key ] ) || null;

      // solve data dependencies
      solveDependencies( dataset, callback );

      // return result dataset (only synchron)
      return dataset;

      /**
       * @summary find dataset(s) by query
       * @returns {ccm.types.dataset[]} dataset(s)
       */
      function find() {

        /**
         * result dataset(s)
         * @type {ccm.types.dataset[]}
         */
        var results = [];

        /**
         * number of founded processing datasets
         * @type {number}
         */
        var counter = 1;

        // iterate over all stored datasets
        for ( var i in my.local ) {

          // query is subset of dataset?
          if ( ccm.helper.isSubset( key, my.local[ i ] ) ) {

            /**
             * founded dataset
             * @type {ccm.types.dataset}
             */
            var dataset = ccm.helper.clone( my.local[ i ] );

            // add founded dataset to result datasets
            results.push( dataset );

            // increment number of founded processing datasets
            counter++;

            // solve founded dataset data dependencies
            solveDependencies( dataset, check );

          }

        }

        // checks if processing of all founded datasets is finished (happens when no data dependencies exists)
        check();

        // return result dataset(s)
        return results;

        /**
         * checks if processing of all founded datasets is finished
         */
        function check() {

          // decrement number of founded processing datasets
          counter--;

          // finished processing of all founded datasets? => perform callback
          if ( counter === 0 && callback) callback( results );

        }

      }

      /**
       * solve ccm data dependencies for ccm dataset
       * @param {ccm.types.dataset} dataset - ccm dataset
       * @param {function} [callback] - callback
       */
      function solveDependencies( dataset, callback ) {

        /**
         * number of loading datasets
         * @type {number}
         */
        var counter = 1;

        /**
         * waitlist for ccm data dependencies which must be solved but wait for loading ccm datastore
         * @type {Array}
         */
        var waiter = [];

        // search dataset for dependencies
        search( dataset );

        // check if all data dependencies are solved (happens when no data dependencies exists)
        check();

        /**
         * search array or object for dependencies (recursive)
         * @param {Array|Object} array_or_object
         */
        function search( array_or_object ) {

          // iterate over dataset properties
          for ( var key in array_or_object ) {

            /**
             * property value
             * @type {*}
             */
            var value = array_or_object[ key ];

            // value is a ccm dependency? => solve dependency
            if ( ccm.helper.isDependency( value ) ) solveDependency( array_or_object, key ) ;

            // value is an array? => search array elements for data dependencies
            else if ( Array.isArray( value ) || ccm.helper.isObject( value ) ) search( value );  // recursive call

          }

        }

        /**
         * solve data dependency
         * @param {ccm.types.dataset} dataset - dataset or array
         * @param {ccm.types.key} key - key or array index
         */
        function solveDependency( dataset, key ) {

          // needed ccm datastore is loading => add data dependency to waitlist
          if ( stores[ getSource( dataset[ key ][ 1 ] ) ] === null )
            return waiter.push( [ solveDependency, dataset, key ] );

          // increase number of loading datasets
          counter++;

          // solve data dependency
          ccm.helper.solveDependency( dataset, key, check );

        }

        /**
         * check if all data dependencies are solved
         */
        function check() {

          // decrease number of loading datasets
          counter--;

          // are not all data dependencies solved? => abort
          if ( counter !== 0 ) return;

          // waitlist not empty? => abort and solve a data dependency in waitlist
          if ( waiter.length > 0 ) return ccm.helper.action( waiter.pop() );

          // perform callback with result dataset
          if ( callback ) callback( dataset );

        }

      }

    }

    /**
     * @summary set dataset in local cache
     * @private
     * @param {ccm.types.dataset} dataset
     */
    function setLocal( dataset ) {

      if ( dataset.key ) my.local[ dataset.key ] = dataset;

    }

    /**
     * @summary update dataset in local cache
     * @private
     * @param {ccm.types.dataset} priodata - priority data
     * @param {function} [callback] - callback (first parameter is created or updated dataset)
     * @returns {ccm.types.dataset} created or updated dataset
     */
    function updateLocal( priodata, callback ) {

      // is dataset local cached? => update local dataset
      if ( my.local[ priodata.key ] )
        ccm.helper.integrate( priodata, my.local[ priodata.key ] );

      // dataset not local cached => cache dataset locally
      else my.local[ priodata.key ] = priodata;

      // return local cached dataset
      return getLocal( priodata.key, callback );

    }

    /**
     * @summary delete dataset in local cache
     * @private
     * @param {ccm.types.key} [key] - dataset key (default: delete complete local cache)
     * @param {function} [callback] - callback  (first parameter is deleted dataset)
     * @returns {ccm.types.dataset} deleted dataset
     */
    function delLocal( key, callback ) {

      /**
       * local cached dataset
       * @type {ccm.types.dataset}
       */
      var dataset;

      // no dataset key?
      if ( key === undefined ) {

        // get and clear local cache
        dataset = my.local;
        my.local = {};

      }

      // has dataset key
      else {

        // get and delete dataset
        dataset = my.local[ key ];
        delete my.local[ key ];

      }

      // perform callback with deleted dataset
      if ( callback ) callback( dataset );

      // return deleted dataset
      return dataset;

    }

    /**
     * @summary get object store from IndexedDB
     * @private
     * @returns {object}
     */
    function getStore() {

      /**
       * IndexedDB transaction
       * @type {object}
       */
      var trans = db.transaction( [ my.store ], 'readwrite' );

      // return object store from IndexedDB
      return trans.objectStore( my.store );

    }

    /**
     * @summary prepare GET parameter data
     * @private
     * @param data - individual GET parameters
     * @returns {object} complete GET parameter data
     */
    function prepareData( data ) {

      data = ccm.helper.integrate( data, { db: my.db, store: my.store } );
      if ( my.user && my.user.isLoggedIn() )
        data = ccm.helper.integrate( data, { user: my.user.data().key, token: my.user.data().token } );
      return data;

    }

    /**
     * @summary send data to server interface via websocket connection
     * @private
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useWebsocket( data, callback ) {

      callbacks.push( callback );
      data.callback = callbacks.length;
      my.socket.send( JSON.stringify( data ) );

    }

    /**
     * @summary send data to server interface via http request
     * @private
     * @param {object} data - GET parameter data
     * @param {function} callback - callback for server response
     */
    function useHttp( data, callback ) {

      ccm.load( [ my.url, data ], callback );

    }

    /**
     * @summary checks server response
     * @private
     * @param {*} [response] - server response
     * @returns {boolean}
     */
    function checkResponse( response ) {

      // server response is error message?
      if ( typeof response === 'string' ) {

        // abort processing
        return false;

      }

      // continue processing
      return true;

    }

  };

  return {

    /*---------------------------------------------- public ccm members ----------------------------------------------*/

    /**
     * @summary callbacks when loading cross domain json files
     * @memberOf ccm
     * @type {Object.<string, function>}
     * @ignore
     */
    callback: {},

    /**
     * @summary contains global namespaces for <i>ccm</i> components
     * @memberOf ccm
     * @type {Object.<ccm.types.index, objects>}
     */
    components: {},

    /**
     * @summary <i>ccm</i> version number
     * @memberOf ccm
     * @type {ccm.types.version}
     * @readonly
     */
    version: [ 8, 0, 0 ],

    /*---------------------------------------------- public ccm methods ----------------------------------------------*/

    clear: function () {
      resources = {};
      stores = {};
    },

    /**
     * @summary load resource(s) (js, css, json and/or data from server interface)
     * @memberOf ccm
     * @param {...string|Array} resources - resource(s) URLs
     * @param {function} [callback] - callback when all resources are loaded (first parameter are the results)
     * @returns {*} results (only if all resources already loaded)
     * @example
     * // load ccm component with callback (local path)
     * ccm.load( 'ccm.chat.js', function ( component ) {...} );
     * @example
     * // load ccm component without callback (cross domain)
     * ccm.load( 'http://akless.github.io/ccm-developer/resources/ccm.chat.min.js' );
     * @example
     * // load javascript file (local path)
     * ccm.load( 'scripts/helper.js' );
     * @example
     * // load jQuery UI (cross domain)
     * ccm.load( 'https://code.jquery.com/ui/1.11.4/jquery-ui.min.js' );
     * @example
     * // load css file (local path)
     * ccm.load( 'css/style.css' );
     * @example
     * // load image file (cross domain)
     * ccm.load( 'http://www.fh-lsoopjava.de/ccm/img/dialogbox.png' );
     * @example
     * // load json file with callback (local path)
     * ccm.load( 'json/data.json', function ( data ) { console.log( data ); } );
     * @example
     * // load json file with callback (cross domain), json file must look like this: ccm.callback[ 'ccm.chat.templates.min.json' ]( {...} );
     * ccm.load( 'http://akless.github.io/ccm-developer/resources/ccm.chat.templates.min.json', function ( data ) {...} );
     * @example
     * // data exchange between client and server php interface with callback (cross domain), php file must use jsonp
     * ccm.load( [ 'http://www.fh-lsoopjava.de/ccm/php/greetings.php', { name: 'world' } ], function ( response ) { console.log( response ); } );
     */
    load: function () {

      /**
       * number of loading resources
       * @type {number}
       */
      var counter = 1;

      /**
       * results
       * @type {*}
       */
      var results = [];

      /**
       * convert arguments to real array
       * @type {Array}
       */
      var args = ccm.helper.makeIterable( arguments );

      /**
       * current ccm.load call
       * @type {ccm.types.action}
       */
      var call = args.slice( 0 ); call.unshift( ccm.load );

      /**
       * is this ccm.load call already waiting for currently loading resource(s)?
       * @type {boolean}
       */
      var waiting = false;

      /**
       * callback when all resources are loaded
       * @type {function}
       */
      var callback;

      // last argument is callback? => seperate arguments and callback
      if ( typeof args[ args.length - 1 ] === 'function' || args[ args.length - 1 ] === undefined )
        callback = args.pop();

      // iterate over all resource URLs => load resource
      args.map( loadResource );

      // check if all resources are loaded (important if all resources already loaded)
      return check();

      /**
       * load resource
       * @param {string|Array} url - resource URL
       * @param {number} i
       */
      function loadResource( url, i ) {

        /**
         * GET parameter for potentially data exchange with server
         * @type {object}
         */
        var data;

        // URL is an array?
        if ( Array.isArray( url ) ) {

          // second array element is an object? => get URL of server interface and GET parameter
          if ( url.length > 1 && ccm.helper.isObject( url[ 1 ] ) ) { data = url[ 1 ]; url = url[ 0 ]; }

          // load resources serial
          else { counter++; results[ i ] = []; return serial( null ); }

        }

        /**
         * already loaded value for this resource
         * @type {string}
         */
        var resource = resources[ url ];

        // mark resource as 'loading'
        resources[ url ] = null;

        // increase number of loading resources
        counter++;

        // GET parameter exists? => perform data exchange
        if ( data ) return exchangeData();

        /**
         * resource suffix
         * @type {string}
         */
        var suffix = url.split( '.' ).pop();

        // check resource suffix => load resource
        switch ( suffix ) {
          case 'html':
            return loadHTML();
          case 'css':
            return loadCSS();
          case 'jpg':
          case 'gif':
          case 'png':
          case 'svg':
            return loadImage();
          case 'js':
            return loadJS();
          case 'json':
            return loadJSON();
          default:
            exchangeData();
        }

        function ajax( url, type, async, user, password, callback ) {

          //var parameters = "first=barack&last=obama";

          switch ( type ) {
            case 'html':
              type = 'text/html';
              break;
            case 'js':
            case 'json':
              type = 'application/javascript';
              break;
          }

          var request = new XMLHttpRequest();
          request.open( 'GET', url, async, user, password );
          request.setRequestHeader( 'Content-type', type );

          //xmlHttp.setRequestHeader("Content-length", parameters.length);
          //xmlHttp.setRequestHeader("Connection", "close");

          request.onreadystatechange = function () {
            if( request.readyState == 4 && request.status == 200 )
              callback( request.responseText );
          };
          request.send();

        }

        /**
         * loads the content of a HTML file
         */
        function loadHTML() {

          // prevent loading resource twice
          if ( caching() ) return;

          // not cross domain request? => load content without JSONP
          if ( url.indexOf( 'http' ) !== 0 )
            return ajax( url, 'html', true, undefined, undefined, successData );

          /**
           * name of html file
           * @type {string}
           */
          var filename = url.split( '/' ).pop();

          // deposit success callback
          ccm.callback[ filename ] = successData;

          // load (and execute) content of html file
          document.head.appendChild( ccm.helper.html( { tag: 'script', src: url } ) );

        }

        /**
         * load css file
         */
        function loadCSS() {

          // prevent loading resource twice
          if ( caching() ) return;

          var tag = ccm.helper.html( { tag: 'link', rel: 'stylesheet', type: 'text/css', href: url } );
          document.head.appendChild( tag );
          tag.onload = success;

        }

        /**
         * (pre)load image file
         */
        function loadImage() {

          // prevent loading resource twice
          if ( caching() ) return;

          var image = new Image();
          image.src = url;
          image.onload = success;

        }

        /**
         * load (and execute) javascript file
         */
        function loadJS() {

          // prevent loading resource twice
          if ( caching() ) return;

          var tag = ccm.helper.html( { tag: 'script', src: url } );
          document.head.appendChild( tag );
          tag.onload = success;

        }

        /**
         * loads the content of a JSON file
         */
        function loadJSON() {

          // prevent loading resource twice
          if ( caching() ) return;

          // not cross domain request? => load content without JSONP
          if ( url.indexOf( 'http' ) !== 0 )
            return ajax( url, 'json', true, undefined, undefined, function ( result ) {
              successData( JSON.parse( result ) );
            } );

          /**
           * name of json file
           * @type {string}
           */
          var filename = url.split( '/' ).pop();

          // deposit success callback
          ccm.callback[ filename ] = successData;

          // load (and execute) content of json file
          document.head.appendChild( ccm.helper.html( { tag: 'script', src: url } ) );

        }

        /**
         * exchange data with server
         */
        function exchangeData() {

          // is this ccm.load call already waiting for currently loading resource(s)? => skip data exchange
          if ( waiting ) return;

          // is cross domain request? => use JSONP
          if ( url.indexOf( 'http' ) === 0 ) {

            jQuery.ajax( {  // TODO: jQuery.ajax

              url: url,
              data: data,
              dataType: 'jsonp',
              username: data && data.username ? data.username : undefined,
              password: data && data.password ? data.password : undefined,
              success: successData

            } );

          }

          // inner domain request => normal HTTP GET request
          else {

            jQuery.ajax( {  // TODO: jQuery.ajax

              url: url,
              data: data,
              username: data && data.username ? data.username : undefined,
              password: data && data.password ? data.password : undefined,
              success: successData

            } ).fail( onFail );

          }

        }

        /**
         * load resources serial (recursive)
         */
        function serial( result ) {

          // not first call? => save result
          if ( result !== null ) results[ i ].push( result );

          // more resources to load serial?
          if ( url.length > 0 ) {

            /**
             * next resource that must load serial
             * @type {*}
             */
            var next = url.shift();

            // next is array of resources? (and not GET parameter)
            if ( Array.isArray( next ) && !( next.length > 1 && ccm.helper.isObject( next[ 1 ] ) ) ) {

              // push callback to array of resources
              next.push( serial );

              // load resources parallel (recursive call)
              ccm.load.apply( null, next );

            }

            // one resource => load serial (recursive call)
            else ccm.load( next, serial );

          }

          // serial loading finished => check if all resources are loaded
          else check();

        }

        /**
         * prevents loading a resource twice
         * @returns {boolean} abort current ccm.load call
         */
        function caching() {

          // is resource currently loading?
          if ( resource === null ) {

            // is this ccm.load call already waiting? => abort current ccm.load call (counter will not decrement)
            if ( waiting ) return true; else waiting = true;

            // no waitlist for currently loading resource exists? => create waitlist
            if ( !waiter[ url ] ) waiter[ url ] = [];

            // add ccm.load call to waitlist
            waiter[ url ].push( call );

            // abort current ccm.load call (counter will not decrement)
            return true;

          }

          // resource already loaded?
          if ( resource ) {

            // result is already loaded resource value
            results[ i ] = resources[ url ] = resource;

            // skip loading process
            success(); return true;

          }

          // continue current ccm.load call
          return false;

        }

        /**
         * callback when a data exchange is successful
         * @param {*} data - received data
         */
        function successData( data ) {

          // add received data to results and already loaded resources
          results[ i ] = resources[ url ] = data;

          // perform success callback
          success();

        }

        /**
         * callback when a resource is successful loaded
         */
        function success() {

          // add url to results and already loaded resources
          if ( results[ i ] === undefined ) results[ i ] = resources[ url ] = url;

          // is resource on waitlist? => perform waiting actions
          while ( waiter[ url ] && waiter[ url ].length > 0 )
            ccm.helper.action( waiter[ url ].pop() );

          // check if all resources are loaded
          check();

        }

        /**
         * @summary callback when a server request fails
         * @param {ccm.types.JqXHR} jqxhr
         * @param {string} textStatus
         * @param {string} error
         */
        function onFail( jqxhr, textStatus, error ) {

          // print error object in console
          console.log( jqxhr, this.url );

          // show error report in website
          alert( jqxhr.responseText + '\n\nRequest Failed: ' + textStatus + ', ' + error );

        }

      }

      /**
       * check if all resources are loaded
       * @returns {*} results (only if all resources already loaded)
       */
      function check() {

        // decrease number of loading resources
        counter--;

        // are all resources loaded?
        if ( counter === 0 ) {

          // only one result? => use no array
          if ( results.length <= 1 ) results = results[ 0 ];

          // perform callback with results
          if ( callback ) callback( results );

          // return results
          return results;

        }

      }

    },

    /**
     * @summary register <i>ccm</i> component in the <i>ccm</i> framework
     * @memberOf ccm
     * @param {ccm.types.component|ccm.types.url|ccm.types.index} component - object, URL or index of a <i>ccm</i> component
     * @param {ccm.types.config} [config] - default <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> component is registered (first parameter is the object of the registered <i>ccm</i> component)
     * @returns {ccm.types.component} object of the registered <i>ccm</i> component (only if synchron)
     * @example ccm.component( { index: 'chat-2.1.3', Instance: function () { ... } } );
     * @example ccm.component( { name: 'chat', version: [2,1,3], Instance: function () {...} } );
     * @example ccm.component( { name: 'blank', Instance: function () {...} } );
     * @example ccm.component( 'ccm.blank.js );
     * @example ccm.component( 'http://akless.github.io/ccm-developer/resources/ccm.chat.min.js' );
     */
    component: function ( component, config, callback ) {

      // default ccm instance configuration is a function? => configuration is callback
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      // is URL of component? => load component and finish registration
      if ( typeof component === 'string' )
        return components[ getIndex( component ) ] ? finish() : ccm.load( component, finish );

      // set component index
      setIndex();

      // component already registered? => finish registration
      if ( components[ component.index ] ) return finish();

      // register component
      components[ component.index ] = component;

      // setup component
      setup();

      // initialize component
      if ( component.init ) { component.init( finish ); delete component.init; } else return finish();

      /**
       * @summary get ccm component index by URL
       * @private
       * @param {string} url - ccm component URL
       * @returns {ccm.types.index} ccm component index
       */
      function getIndex( url ) {

        // url is already an ccm component index? => abort and return it
        if ( url.indexOf( '.js' ) === -1 ) return url;

        /**
         * from given url extracted filename of the ccm component
         * @type {string}
         */
        var filename = url.split( '/' ).pop();

        // abort if extracted filename is not a valid filename for a ccm component
        if ( !ccm.helper.regex( 'filename' ).test( filename ) ) return '';

        // filter and return the component index out of the extracted filename
        var split = filename.split( '.' );
        if ( split[ 0 ] === 'ccm' )
          split.shift();
        split.pop();
        if ( split[ split.length - 1 ] === 'min' )
          split.pop();
        return split.join( '.' );

      }

      /**
       * set ccm component index
       */
      function setIndex() {

        // has component index?
        if ( component.index ) {

          /**
           * name and version number of ccm component
           * @type {Array}
           */
          var array = component.index.split( '-' );

          // add name of ccm component
          component.name = array[ 0 ];

          // add version number of ccm component
          if ( array.length > 1 ) {
            component.version = array[ 1 ].split( '.' );
            for ( var i = 0; i < 3; i++ )
              component.version[ i ] = parseInt( component.version[ i ] );
          }

        }

        // component index is component name
        component.index = component.name;

        // has version? => append version number to component index
        if ( component.version )
          component.index += '-' + component.version.join( '.' );

      }

      /**
       * setup ccm component
       */
      function setup() {

        // add ccm instance counter
        component.instances = 0;

        // add function for creating and rendering ccm instances
        component.instance = function ( config, callback ) { return ccm.instance( component.index, config, callback ); };
        component.render   = function ( config, callback ) { return ccm.render  ( component.index, config, callback ); };

        // set default of default ccm instance configuration
        if ( !component.config )         component.config         = {};
        //if ( !component.config.element ) component.config.element = document.body;

        // create HTML tag for ccm component
        createCustomElement();

        /**
         * create HTML tag for ccm component
         */
        function createCustomElement() {

          var tag = Object.create( HTMLElement.prototype );
          tag.attachedCallback = function () {
            if ( !document.body.contains( this ) ) return;
            var config = ccm.helper.generateConfig( this );
            config.element = this;
            component.render( config );
          };
          document.registerElement( 'ccm-' + component.index, { prototype: tag } );

        }

      }

      /**
       * finish registration of component
       * @returns {ccm.types.component}
       */
      function finish() {

        // make deep copy of component
        component = ccm.helper.clone( components[ typeof component === 'string' ? getIndex( component ) : component.index ] );

        // component has individual default for default instance configuration?
        if ( config ) {

          // default ccm instance configuration is a HTML element node? => configuration has only element property
          if ( ccm.helper.isElementNode( config ) ) config = { element: config };

          // set given default of default ccm instance configuration
          component.config = ccm.helper.integrate( ccm.helper.clone( config ), component.config );

          // open closure for correct later variable visibility
          closure( component );

        }

        // perform callback with component
        if ( callback ) callback( component );

        // return component
        return component;

        function closure( component ) {

          // has given default for default instance configuration? => consider this in later instance() and render() calls
          if ( component.config ) {
            component.instance = function ( config, callback ) { if ( ccm.helper.isElementNode( config ) ) config = { element: config }; config = ccm.helper.integrate( config, ccm.helper.clone( component.config ) ); return ccm.instance( component.index, config, function ( instance ) { instance.component = component; if ( callback ) callback( instance ); } ); };
            component.render   = function ( config, callback ) { if ( ccm.helper.isElementNode( config ) ) config = { element: config }; config = ccm.helper.integrate( config, ccm.helper.clone( component.config ) ); return ccm.render  ( component.index, config, function ( instance ) { instance.component = component; if ( callback ) callback( instance ); } ); };
          }

        }

      }

    },

    /**
     * @summary creates an <i>ccm</i> instance out of a <i>ccm</i> component
     * @memberOf ccm
     * @param {ccm.types.index|ccm.types.url} component - index, object or URL of a <i>ccm</i> component
     * @param {ccm.types.config|function} [config] - <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> instance is created (first parameter is the created <i>ccm</i> instance)
     * @returns {ccm.types.instance} created <i>ccm</i> instance (only if synchron)
     * @example ccm.instance( 'ccm.chat.js', { key: 'demo' }, function ( instance ) {...} );
     */
    instance: function ( component, config, callback ) {

      // ccm instance configuration is a function? => configuration is callback
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      /**
       * @summary number of loading resources
       * @type {number}
       */
      var counter = 0;

      /**
       * result ccm instance
       * @type {ccm.types.instance}
       */
      var result;

      /**
       * @summary waitlist of unsolved dependencies
       * @type {ccm.types.action[]}
       */
      var waiter = [];

      // start recursion to solve dependencies
      return recursive( component, config );

      /**
       * recursion to create instance and solve dependencies (in breadth-first-order)
       * @param {string|object} comp - index, object or URL of component
       * @param {ccm.types.config} [cfg={}] - instance configuration (current recursive level)
       * @param {ccm.types.config} [prev_cfg] - parent instance configuration (previous recursive level)
       * @param {string} [prev_key] - relevant key in parent instance configuration (previous recursive level)
       * @param {string} [parent] - parent instance (previous recursive level)
       * @returns {ccm.types.instance} created instance (only if synchron)
       */
      function recursive( comp, cfg, prev_cfg, prev_key, parent ) {

        // increase number of loading resources
        counter++;

        // make sure that the component is registered and get it's component index
        var async = false;
        var comp = ccm.component( comp, function ( comp ) {
          if ( async ) proceed( comp.index );
        } );
        if ( comp ) return proceed( comp.index );
        async = true;

        /**
         * @param {ccm.types.index} index - component index
         * @returns {ccm.types.instance} created ccm instance (only if synchron)
         */
        function proceed( index ) {

          // load instance configuration if necessary (asynchron)
          return ccm.helper.isDependency( cfg ) ? ccm.dataset( cfg[ 1 ], cfg[ 2 ], proceed ) : proceed( cfg );

          function proceed( cfg ) {

            // ccm instance configuration is a HTML element node? => configuration has only element property
            if ( ccm.helper.isElementNode( cfg ) ) cfg = { element: cfg };

            /**
             * created instance
             * @type {ccm.types.instance}
             */
            var instance = new components[ index ].Instance();

            // integrate created instance
            components[ index ].instances++;                    // increment instance counter
            if ( prev_cfg ) prev_cfg[ prev_key ] = instance;    // set instance in instance configuration (previous recursive level)
            if ( parent ) instance.parent = parent;             // set parent instance
            if ( !result ) result = instance;                   // set result instance

            // configure created instance
            ccm.helper.integrate( ccm.helper.clone( components[ index ].config ), instance );  // set default ccm instance configuration
            if ( cfg ) ccm.helper.integrate( cfg, instance );   // integrate ccm instance configuration
            instance.id = components[ index ].instances;        // set ccm instance id
            instance.index = index + '-' + instance.id;         // set ccm instance index
            instance.component = components[ index ];           // set ccm component reference

            switch ( instance.element ) {
              case 'name': instance.element = ccm.helper.find( parent, '.' + instance.component.name ); break;
              case 'parent': instance.element = parent.element; break;
              /*
              default:
                if ( instance.element.selector ) // TODO: element.selector
                  instance.element.selector = instance.element.selector.replace( /-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)/g, function ( match ) {
                    return match.replace( /\./g, '\\.' );
                  } )
              */
            }

            // solve dependencies of created ccm instance
            solveDependencies( instance );

            // check if all dependencies are solved
            return check();

            /**
             * solve dependencies of created ccm instance (recursive)
             * @param {ccm.types.instance|Array} instance_or_array - ccm instance or inner array
             */
            function solveDependencies( instance_or_array ) {

              // iterate over all ccm instance properties
              for ( var key in instance_or_array ) {

                /**
                 * property value
                 * @type {*}
                 */
                var value = instance_or_array[ key ];

                // is dependency? => solve dependency
                if ( ccm.helper.isDependency( value ) ) solveDependency( instance_or_array, key );

                // value is an array or object?
                else if ( typeof value === 'object' && value !== null ) {

                  // not relevant object type? => skip
                  if ( ccm.helper.isNode( value ) || ccm.helper.isInstance( value ) || ccm.helper.isComponent( value ) ) continue;

                  // search it for dependencies (recursive call)
                  solveDependencies( value );

                }

              }

              /**
               * solve ccm instance dependency
               * @param {ccm.types.instance|Array} instance_or_array - ccm instance or inner array
               * @param {string|number} key - ccm instance property key or array index
               */
              function solveDependency( instance_or_array, key ) {

                /**
                 * ccm instance dependency that must be solved
                 * @type {ccm.types.action}
                 */
                var action = instance_or_array[ key ];

                // check type of dependency => solve dependency
                switch ( action[ 0 ] ) {

                  case ccm.load:
                  case "ccm.load":
                    counter++;
                    if ( action.length === 2 )
                      ccm.load( action[ 1 ], setResult );
                    else {
                      action.shift();
                      ccm.load( action, setResult );
                    }
                    break;

                  case ccm.component:
                  case "ccm.component":
                    counter++;
                    ccm.component( action[ 1 ], action[ 2 ], setResult );
                    break;

                  case ccm.instance:
                  case "ccm.instance":
                    waiter.push( [ recursive, action[ 1 ], action[ 2 ], instance_or_array, key, instance ] );
                    break;

                  case ccm.proxy:
                  case "ccm.proxy":
                    proxy( action[ 1 ], action[ 2 ], instance_or_array, key, instance );
                    break;

                  case ccm.store:
                  case "ccm.store":
                    counter++;
                    if ( !action[ 1 ] ) action[ 1 ] = {};
                    action[ 1 ].delayed = true;
                    ccm.store( action[ 1 ], setResult );
                    break;

                  case ccm.dataset:
                  case "ccm.dataset":
                    counter++;
                    ccm.dataset( action[ 1 ], action[ 2 ], setResult );
                    break;

                }

                /**
                 * set result of solved ccm instance dependency
                 * @param {*} result
                 */
                function setResult( result ) {

                  // set result of solved ccm instance dependency
                  instance_or_array[ key ] = result;

                  // check if all ccm instance dependencies are solved
                  check();

                }

                /**
                 * create proxy for lazy loading ccm instance
                 * @param {string} component - URL of ccm component
                 * @param {ccm.types.config} [config={}] - ccm instance configuration, see documentation of associated ccm component
                 * @param {ccm.types.instance|Array} instance_or_array - parent ccm instance or inner array
                 * @param {string|number} key - parent ccm instance property key or array index
                 * @param {ccm.types.instance} parent - parent ccm instance
                 */
                function proxy( component, config, instance_or_array, key, parent ) {

                  // load instance configuration if necessary (asynchron)
                  ccm.helper.isDependency( config ) ? ccm.dataset( config[ 1 ], config[ 2 ], proceed ) : proceed( config );

                  function proceed( config ) {

                    instance_or_array[ key ] = {
                      component: component,
                      parent: parent,
                      render: function ( callback ) {
                        delete this.component;
                        delete this.render;
                        if ( !config ) config = {};
                        ccm.helper.integrate( this, config );
                        ccm.render( component, config, function ( instance ) {
                          instance_or_array[ key ] = instance;
                          if ( callback ) callback();
                        } );
                      }
                    };

                  }

                }

              }

            }

            /**
             * check if all ccm instance dependencies are solved
             * @returns {ccm.types.instance} created instance (nur wenn synchron)
             */
            function check() {

              // decrease number of loading resources
              counter--;

              // are all ccm instance dependencies solved?
              if ( counter === 0 ) {

                // waitlist not empty? => continue with waiting unsolved dependencies
                if ( waiter.length > 0 ) return ccm.helper.action( waiter.shift() );    // recursive call

                // initialize created instances (start recursive with result instance)
                initialize( result, function () {

                  // perform callback with result instance
                  if ( callback ) callback( result );

                } );

              }

              // return result instance (only synchron)
              return counter === 0 ? result : null;

            }

            /**
             * initialize ccm instance and all its dependent ccm instances and datastores (recursive)
             * @param {ccm.types.instance|object|Array} instance - ccm instance or inner object or array
             * @param {function} callback
             */
            function initialize( instance, callback ) {

              /**
               * founded ccm instances and datastores
               * @type {Array.<ccm.types.instance|ccm.Datastore>}
               */
              var results = [ instance ];

              // find all ccm instances
              find( instance );

              // see order of results
              //console.log( 'ccm#initialize', instance.index, results.map( function ( result ) { return result.index } ) );

              // initialize all founded ccm instances
              var i = 0; init();

              /**
               * find all ccm instances and datastores (breadth-first-order, recursive)
               * @param {object} obj - object
               */
              function find( obj ) {

                /**
                 * founded relevant inner objects and arrays
                 * @type {Array.<object|Array>}
                 */
                var inner = [];

                // find all dependent ccm instances
                for ( var key in obj ) {
                  var value = obj[ key ];

                  // value is a ccm instance? (but not parent and not a ccm proxy instance) => add to founded relevant inner object and arrays
                  if ( ccm.helper.isInstance( value ) && key !== 'parent' && !ccm.helper.isProxy( value) ) inner.push( value );

                  // value is an array or object?
                  else if ( Array.isArray( value ) || ccm.helper.isObject( value ) ) {

                    // not relevant object type? => skip
                    if ( ccm.helper.isNode( value ) || ccm.helper.isComponent( value ) || ccm.helper.isInstance( value ) ) continue;

                    // add to founded relevant inner object and arrays
                    inner.push( value );

                  }

                }

                // add founded inner ccm instances and datastores to results
                inner.map( function ( obj ) { if ( ccm.helper.isInstance( obj ) || ccm.helper.isDatastore( obj ) ) results.push( obj ); } );

                // go deeper (recursive calls)
                inner.map( function ( obj ) { find( obj ); } );

              }

              /**
               * initialize all founded ccm instances and datastores (recursive, asynchron)
               */
              function init() {

                // all results initialized? => perform ready functions
                if ( i === results.length ) return ready();

                /**
                 * first founded and not init-checked result
                 * @type {ccm.types.instance|ccm.Datastore}
                 */
                var obj = results[ i ]; i++;

                // result is not initialized? => perform init function and check next result afterwards (recursive call)
                if ( obj.init ) obj.init( function () { delete obj.init; init(); } ); else init();

              }

              /**
               * performs ready function of each founded ccm instance (recursive, asynchron)
               */
              function ready() {

                // all ready functions are called? => perform callback
                if ( results.length === 0 ) return callback();

                /**
                 * last founded and not ready-checked result
                 * @type {ccm.types.instance}
                 */
                var obj = results.pop();

                // delete init function
                delete obj.init;

                // result has a ready function? => perform and delete ready function and check next result afterwards (recursive call)
                if ( obj.ready ) { var tmp = obj.ready; delete obj.ready; tmp( ready ); } else ready();

              }

            }

          }

        }

      }

    },

    /**
     * @summary render <i>ccm</i> instance in website area
     * @memberOf ccm
     * @param {ccm.types.index|ccm.types.url} component - index or URL of a <i>ccm</i> component
     * @param {ccm.types.config} [config] - <i>ccm</i> instance configuration (check documentation of associated <i>ccm</i> component to see which properties could be set)
     * @param {function} [callback] - callback when <i>ccm</i> instance is rendered (first parameter is the rendered <i>ccm</i> instance)
     * @returns {ccm.types.instance} rendered <i>ccm</i> instance (only if synchron)
     * @example ccm.render( 'ccm.blank.js', { element: jQuery( '#container' ) } );
     */
    render: function ( component, config, callback ) {

      // ccm instance configuration is a function? => configuration is callback
      if ( typeof config === 'function' ) { callback = config; config = undefined; }

      // create ccm instance out of ccm component
      ccm.instance( component, config, function ( instance ) {

        // render ccm instance in her website area
        instance.render( function () {

          // perform callback with ccm instance
          if ( callback ) callback( instance );

        } );

      } );

    },

    /**
     * @summary provides a <i>ccm</i> datastore
     * @description
     * A <i>ccm</i> datastore could be used for easy data management on different switchable data levels.
     * With no first parameter the method provides a empty <i>ccm</i> datastore of data level 1.
     * In this case the callback could be the first parameter directly.
     * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management} for general informations about <i>ccm</i> data management.
     * @memberOf ccm
     * @param {ccm.types.settings} [settings={}] - <i>ccm</i> datastore settings (see [here]{@link ccm.types.settings} for more details)
     * @param {ccm.types.storeResult} [callback] - when datastore is ready for use
     * @returns {ccm.Datastore} <i>ccm</i> datastore (only if no inner operation is asynchron)
     * @example
     * // get result as first parameter of the callback
     * var settings = {...};
     * ccm.store( settings, function ( result ) { console.log( result ); } );
     * @example
     * // get result as return value (only if no inner operation is asynchron)
     * var settings = {...};
     * var result = ccm.store( settings );
     * console.log( result );
     * @example
     * // provides a empty <i>ccm</i> datastore of data level 1
     * ccm.store( function ( result ) { console.log( result ); } );
     * // without given settings the callback could be the first parameter directly
     * @example
     * // provides a empty <i>ccm</i> datastore of data level 1
     * ccm.store( function ( result ) { console.log( result ); } );
     * // without given settings the callback could be the first parameter directly
     */
    store: function ( settings, callback ) {

      // given settings are a function? => settings are callback
      if ( typeof settings === 'function' ) { callback = settings; settings = undefined; }

      // no given settings? => use empty object
      if ( !settings ) settings = {};

      // given settings are an URL or a collection of ccm datasets? => wrap object
      if ( typeof settings === 'string' || ( ccm.helper.isObject( settings ) && !settings.local && !settings.store && !settings.url && !settings.delayed && !settings.user ) ) settings = { local: settings };

      // make deep copy of given settings
      settings = ccm.helper.clone( settings );

      /**
       * ccm datastore source
       * @type {string}
       */
      var source = getSource( settings );

      // existing ccm datastore have the same source?
      if ( stores[ source ] ) {

        // perform callback with existing ccm datastore
        if ( callback ) callback( stores[ source ] );

        // return existing ccm datastore
        return stores[ source ];

      }

      // add ccm datastore source to ccm datastore settings
      if ( !settings.source ) settings.source = source;

      // no local cache? => use empty object
      if ( !settings.local ) settings.local = {};

      // local cache is an URL? => load initial datasets for local cache (could be asynchron)
      return typeof settings.local === 'string' ? ccm.load( settings.local, proceed ) : proceed( settings.local );

      /**
       * proceed with creating ccm datastore
       * @param {ccm.types.datasets} datasets - initial datasets for local cache
       * @returns {ccm.Datastore} created ccm datastore
       */
      function proceed( datasets ) {

        // set initial datasets for local cache
        settings.local = datasets;

        // prepare ccm database if necessary (asynchron)
        return settings.store && !settings.url ? prepareDB( proceed ) : proceed();

        /**
         * prepare ccm database
         * @param {function} callback
         */
        function prepareDB( callback ) {

          // open ccm database if necessary (asynchron)
          !db ? openDB( proceed ) : proceed();

          /**
           * open ccm database
           * @param {function} callback
           */
          function openDB( callback ) {

            /**
             * request for opening ccm database (asynchron)
             * @type {object}
             */
            var request = indexedDB.open( 'ccm' );

            // set success callback
            request.onsuccess = function () {

              // set database object
              db = this.result;

              // perform callback
              callback();

            };

          }

          /**
           * proceed with preparing ccm database
           */
          function proceed() {

            // needed object store in IndexedDB not exists? => update ccm database (asynchron)
            !db.objectStoreNames.contains( settings.store ) ? updateDB( callback ) : callback();

            /**
             * update ccm database
             * @param {function} callback
             */
            function updateDB( callback ) {

              /**
               * current ccm database version number
               * @type {number}
               */
              var version = parseInt( localStorage.getItem( 'ccm' ) );

              // no version number? => start with 1
              if ( !version ) version = 1;

              // close ccm database
              db.close();

              /**
               * request for reopening ccm database
               * @type {object}
               */
              var request = indexedDB.open( 'ccm', version + 1 );

              // set onupgradeneeded callback
              request.onupgradeneeded = function () {

                // set database object
                db = this.result;

                // save new ccm database version number in local storage
                localStorage.setItem( 'ccm', db.version );

                // create new object store
                db.createObjectStore( settings.store, { keyPath: 'key' } );

              };

              // set success callback => perform callback
              request.onsuccess = callback;

            }

          }

        }

        /**
         * proceed with creating ccm datastore
         * @returns {ccm.Datastore} created ccm datastore
         */
        function proceed() {

          /**
           * created ccm datastore
           * @type {ccm.Datastore}
           */
          var store = new Datastore();

          // integrate settings in ccm datastore
          ccm.helper.integrate( settings, store );

          // is ccm realtime datastore?
          if ( store.url && store.url.indexOf( 'ws' ) === 0 ) {

            // prepare initial message
            var message = [ store.db, store.store ];
            if ( store.datasets )
              message = message.concat( store.datasets );

            // connect to server
            store.socket = new WebSocket( store.url, 'ccm' );

            // send initial message
            store.socket.onopen = function () { this.send( message ); proceed(); };

          }
          else return proceed();

          /**
           * proceed with creating ccm datastore
           * @returns {ccm.Datastore} created ccm datastore
           */
          function proceed() {

            // delete no more needed property
            delete store.datasets;

            // no delayed initialization?
            if ( !store.delayed ) {

              // initialize ccm datastore
              store.init();

              // delete init function after one-time call
              delete store.init;

            }
            // skipped initialization => delete delayed flag
            else delete store.delayed;

            // add ccm datastore to created ccm datastores
            stores[ source ] = store;

            // perform callback with created ccm datastore
            if ( callback ) callback( store );

            // return created ccm datastore (only synchron)
            return store;

          }

        }

      }

    },

    /**
     * @summary get directly a <i>ccm</i> dataset out of a <i>ccm</i> datastore
     * @memberOf ccm
     * @param {ccm.types.settings} [settings] - <i>ccm</i> datastore settings
     * @param {ccm.types.key|object} [key_or_query] - unique key of the dataset or alternative a query
     * @param {function} [callback] - callback (first parameter is the requested <i>ccm</i> datastore)
     * @returns {ccm.types.dataset} requested <i>ccm</i> dataset (only if synchron)
     */
    dataset: function ( settings, key_or_query, callback ) {

      var store = ccm.store( settings, function ( store ) {

        store.get( key_or_query, callback );

      } );

      if ( store ) return store.get( key_or_query );

    },

    /*-------------------------------------------- public ccm namespaces ---------------------------------------------*/

    /**
     * @summary context functions for traversing in a <i>ccm</i> context tree
     * @memberOf ccm
     * @namespace
     * @ignore
     */
    context: {

      /**
       * @summary find parent instance by property
       * @param {ccm.types.instance} instance - <i>ccm</i> instance (starting point)
       * @param {string} property - instance property
       * @returns {ccm.types.instance} highest result in current ccm context
       */
      find: function ( instance, property ) {

        var start = instance;
        while ( instance = instance.parent )
          if ( instance[ property ] && instance[ property ] !== start )
            return instance[ property ];

      },

      /**
       * @summary get <i>ccm</i> context root
       * @param {ccm.types.instance} instance - <i>ccm</i> instance (starting point)
       * @returns {ccm.types.instance}
       */
      root: function ( instance ) {

        while ( instance.parent )
          instance = instance.parent;

        return instance;

      }

    },

    /**
     * @summary helper functions for <i>ccm</i> component developers
     * @memberOf ccm
     * @namespace
     */
    helper: {

      /**
       * @summary perform action (# for own context)
       * @param {ccm.types.action} action
       * @param {object} [context]
       * @returns {*} return value of performed action
       */
      action: function ( action, context ) {

        // is function without parameters? => perform function
        if ( typeof action === 'function' ) return action();

        // Funktionsname und Parameter als String angegeben?
        if ( typeof action !== 'object' ) {

          // In Array verpacken
          action = action.split( ' ' );
        }

        // Aktion ausführen
        if ( typeof action[ 0 ] === 'function' )
          return action[ 0 ].apply( window, action.slice( 1 ) );
        else
          if ( action[ 0 ].indexOf( 'this.' ) === 0 )
            return this.executeByName( action[ 0 ].substr( 5 ), action.slice( 1 ), context );
          else
            return this.executeByName( action[ 0 ], action.slice( 1 ) );
      },

      /**
       * @summary convert inner <i>ccm</i> component HTML tags of an given <i>ccm</i> instance to accessible <i>ccm</i> instances
       * @description
       * This function does the following things:
       * <ul>
       *   <li>catches all HTML tags for embedding of <i>ccm</i> components inside the childNode property of an <i>ccm</i> instance</li>
       *   <li>creates for each founded <i>ccm</i> component HTML tag an new ccm instance out of the corresponding <i>ccm</i> component</li>
       *   <li>gives every created <i>ccm</i> instance a new empty website area</li>
       *   <li>replaces every founded <i>ccm</i> component HTML tag with the website area of the corresponding created <i>ccm</i> instance</li>
       *   <li>put each created <i>ccm</i> instance in the new object at the childInstances property of the given <i>ccm</i> instance</li>
       * </ul>
       * @param {ccm.types.instance} instance - given <i>ccm</i> instance
       * @param {function} callback
       */
      convertComponentTags: function ( instance, callback ) {  // TODO: not a framework relevant helper function

        // counter for unfinished asynchron tasks
        var counter = 1;

        // no childNodes property? => abort and perform callback
        if ( !Array.isArray( instance.childNodes ) ) return callback();

        instance.childInstances = {};  // TODO: instance.childInstances

        // start recursive search for ccm custom elements
        recursive( instance.childNodes );

        check();

        function recursive( children ) {

          children.map( function ( child, i ) {

            // child is no element node? => skip
            if ( !ccm.helper.isElementNode( child ) ) return;

            // child is no ccm specific HTML tag? => skip and search children of the child (recursive call)
            if ( child.tagName.indexOf( 'CCM-' ) !== 0 ) return recursive( ccm.helper.makeIterable( child.childNodes ) );

            var split = child.tagName.toLowerCase().split( '-' );

            // child is a custom element of the ccm component? => skip
            if ( split[ 1 ] === instance.component.name && split.length > 2 ) return;

            // from here: child is a founded ccm custom element
            // next step: replace child with website area for new ccm instance

            counter++;

            // missing part for config property in tag name? => use component name as default
            if ( split.length < 3 ) split[ 2 ] = split[ 1 ];

            // prepare website area
            var div = document.createElement( 'div' );
            div.setAttribute( 'id', ccm.helper.getElementID( instance ) + '-' + split[ 2 ] );

            // prepare instance configuration
            var config = ccm.helper.generateConfig( child );
            config.parent = instance;
            config.element = div;

            // replace child with website area
            if ( child.parentNode )
              child.parentNode.replaceChild( div, child );
            else
              children[ i ] = div;

            // create new ccm instance and add it to childInstances property of the given ccm instance
            closure( instance, split[ 1 ], config, split[ 2 ] );

            // do it in additional closure because of map iteration in recursive call in combination with asynchron operations (needed?)
            function closure( instance, name, config, key ) {

              // check if there is a individual ccm component object in current ccm context that could be used for instance creation
              var component = ccm.context.find( instance, name );
              if ( ccm.helper.isComponent( component ) && component.name === name )
                component.instance( config, proceed );  // create ccm instance out of a individual ccm component object (with other default values for instance configuration)
              else
                ccm.instance( name, config, proceed );  // create ccm instance out of the unique registered ccm component object within the ccm framework

              function proceed( result ) {
                instance.childInstances[ key ] = result;
                check();
              }
            }
          } );
        }

        function check() {
          counter--;
          if ( counter == 0 ) callback();  // perform callback after all ccm custom HTML tags are converted
        }

      },

      /**
       * @summary create a deep copy of a given value
       * @param {*} value - given value
       * @returns {*} deep copy of given value
       */
      clone: function ( value ) {

        return recursive( value );

        function recursive( value ) {

          if ( ccm.helper.isNode( value ) ) return value;

          if ( Array.isArray( value ) || ccm.helper.isObject( value ) ) {
            var copy = Array.isArray( value ) ? [] : {};
            for ( var i in value )
              copy[ i ] = ccm.helper.clone( value[ i ] );
            return copy;
          }

          return value;

        }

      },

      /**
       * @summary get dataset via object informations
       * @description
       * If the object informations includes a <i>ccm</i> datastore and key and
       * if dataset not exists, a new dataset with given key will be created.
       * @param {ccm.Datastore|{store: ccm.Datastore, key: ccm.key}|ccm.dataset} obj - object with informations how to get the dataset
       * @param {function} [callback] - callback (first parameter is result dataset)
       * @returns {ccm.types.dataset} resulting dataset (only if synchron and dataset exists)
       */
      dataset: function ( obj, callback ) {  // TODO: not a framework relevant helper function

        // no object => abort
        if ( !ccm.helper.isObject( obj ) ) { if ( callback ) callback(); return undefined; }

        // object is datastore directly? => transform to object with datastore and without key
        if ( ccm.helper.isDatastore( obj ) ) obj = { store: obj };

        // object is dataset directly? => return dataset
        if ( !ccm.helper.isDatastore( obj.store ) ) { obj = ccm.helper.clone( obj ); if ( callback ) callback( obj ); return obj; }

        // get dataset from ccm datastore
        return obj.store.get( obj.key || null, function ( dataset ) {

          // no callback? => abort
          if ( !callback ) return;

          /**
           * dataset exists?
           * @type {boolean}
           */
          var exists = dataset !== null;

          // dataset not exists? => perform callback with new dataset (not created in datastore)
          if ( !exists ) callback( { key: obj.key || ccm.helper.generateKey() }, true );

          // dataset exists => perform callback with dataset
          else callback( dataset );

        } );

      },

      dataSource: function ( data ) {  // TODO: not a framework relevant helper function

        return ccm.helper.isDatastore( data.store ) ? { key: data.key, store: data.store.source(), dataset: data.store.get( data.key ) } : data;

      },

      /**
       * @summary get or set the value of a deeper object property
       * @param {object} obj - object that contains the deeper property
       * @param {string} key - key path to the deeper property in dot notation
       * @param {*} [value] - value that should be set for the deeper property
       * @returns {string} value of the deeper property
       * @example
       * var obj = {
       *   test: 123,
       *   foo: {
       *     bar: 'abc',
       *     baz: 'xyz'
       *   }
       * };
       * var result = ccm.helper.deepValue( obj, 'foo.bar' );
       * console.log( result ); // => 'abc'
       * @example
       * var obj = {};
       * var result = ccm.helper.deepValue( obj, 'foo.bar', 'abc' );
       * console.log( obj );    // => { foo: { bar: 'abc' } }
       * console.log( result ); // => 'abc'
       */
      deepValue: function ( obj, key, value ) {

        return recursive( obj, key.split( '.' ), value );

        /**
         * recursive helper function, key path is given as array
         */
        function recursive( obj, key, value ) {

          if ( !obj ) return;
          var next = key.shift();
          if ( key.length === 0 )
            return value !== undefined ? obj[ next ] = value : obj[ next ];
          if ( !obj[ next ] && value !== undefined ) obj[ next ] = {};
          return recursive( obj[ next ], key, value );                  // recursive call

        }

      },

      /**
       * @summary reselect the content area of an <i>ccm</i> instance and add html div tag inside for embedded content with <i>ccm</i> loading icon inside
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @returns {ccm.types.element} added html div tag
       */
      element: function ( instance ) {  // TODO: not a framework relevant helper function

        // TODO: ccm.helper.element call could be automatically done via framework

        if ( !instance.element ) instance.element = document.body;

        // reselect content area of the ccm instance
        //ccm.helper.reselect( instance );

        // CSS classes given as array? => join it to string
        if ( Array.isArray( instance.classes ) ) instance.classes = instance.classes.join( ' ' );

        // prepare website area for own content of ccm instance
        var element = ccm.helper.html( { tag: 'div', id: ccm.helper.getElementID( instance ), class: 'ccm ' + ( instance.classes ? instance.classes : 'ccm-' + instance.component.name ), inner: ccm.helper.loading() } );

        // add prepared website area ccm instance website area
        instance.element.appendChild( element );

        // ...
        instance.element = element;

      },

      /**
       * @summary perform function by function name
       * @param {string} functionName - function name
       * @param {Array} args - function arguments
       * @param {object} [context] - context for this
       * @returns {*} return value of performed function
       * @ignore
       */
      executeByName: function ( functionName, args, context ) {

        if (!context) context = window;
        var namespaces = functionName.split( '.' );
        functionName = namespaces.pop();
        for ( var i = 0; i < namespaces.length; i++ )
          context = context[ namespaces[ i ]];
        return context[ functionName ].apply( context, args );
      },

      /**
       * @summary removes identical property values in priority data
       * @param {object} priodata - priority dataset
       * @param {object} dataset - dataset
       * @returns {object} priority data with removed identical property values
       */
      filter: function ( priodata, dataset ) {  // TODO: not a framework relevant helper function

        // Kopie von Prioritätsdaten verwenden
        priodata = ccm.helper.clone( priodata );

        // Identische Einträge entfernen
        for ( var i in priodata )
          if ( priodata[ i ] === dataset[ i ] )
            delete priodata[ i ];
      },

      filterProperties: function ( obj, properties ) {
        var result = {};
        properties = ccm.helper.makeIterable( arguments );
        properties.shift();
        properties.map( function ( property ) {
          result[ property ] = obj[ property ];
        } );
        return result;
      },

      /**
       * @summary find HTML tags of an <i>ccm</i> instance inside a HTML DOM Element with a CSS selector
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @param {ccm.types.element} [element] - HTML DOM Element (default: website area of <i>ccm</i> instance)
       * @param {string} selector - CSS selector
       */
      find: function ( instance, element, selector ) {

        // element parameter is skippable
        if ( typeof element === 'string' ) { selector = element; element = undefined; }

        // no given element parameter? => use website area of ccm instance
        if ( !element ) element = instance.element;

        var id = ccm.helper.getElementID( instance );
        return element.querySelectorAll( '#' + id + ' ' + selector + ':not(.ccm, #' + id + ' .ccm *)' );

      },

      /**
       * @summary focus input field and set cursor to a specific position
       * @param {ccm.types.element} input - HTML DOM Element of the input field
       * @param {number} [position] - cursor position (default: behind last character)
       */
      focusInput: function( input, position ) {  // TODO: not a framework relevant helper function

        if ( position === undefined ) position = input.value.length;
        input.selectionStart = input.selectionEnd = position;
        input.focus();

      },

      /**
       * @summary replaces placeholder in a string with given values
       * @param {string|object} string - string with containing placeholders
       * @param {...string} [values] - given values
       * @returns {string} string with replaced placeholders
       */
      format: function ( string, values ) {

        var functions = [[],[]];

        string = JSON.stringify( string, function( key, val ) {
          if ( typeof val === 'function' ) { functions[ 0 ].push( val ); return '%f0%'; }
          return val;
        } );

        for ( var i = 1; i < arguments.length; i++ ) {
          if ( typeof arguments[ i ] === 'function' ) { functions[ 1 ].push( arguments[ i ] ); arguments[ i ] = '%f1%'; }
          if ( typeof arguments[ i ] === 'object' )
            for ( var key in arguments[ i ] ) {
              if ( typeof arguments[ i ][ key ] === 'function' ) { functions[ 1 ].push( arguments[ i ][ key ] ); arguments[ i ][ key ] = '%f1%'; }
              if ( typeof arguments[ i ][ key ] === 'string' ) arguments[ i ][ key ] = escape( arguments[ i ][ key ] );
              string = string.replace( new RegExp( '%'+key+'%', 'g' ), arguments[ i ][ key ] );
            }
          else {
            if ( typeof arguments[ i ] === 'string' ) arguments[ i ] = escape( arguments[ i ] );
            string = string.replace( /%%/, arguments[ i ] );
          }
        }

        return JSON.parse( string, function ( key, val ) {
          if ( val === '%f0%' ) return functions[ 0 ].shift();
          if ( val === '%f1%' ) return functions[ 1 ].shift();
          return val;
        } );

        function escape( string ) {
          return string.replace( /"/g, "'" ).replace( /\\/g, '\\\\' ).replace( /\n/g, '\\n' ).replace( /\r/g, '\\r' ).replace( /\t/g, '\\t' ).replace( /\f/g, '\\f' );
        }

      },

      /*
       * @summary Schaltet Inhalt eines Containers auf Vollbildmodus
       * TODO: Vollbildmodus
       *
       fullscreen: function ( container ) {

       //var html = jQuery( 'body' ).clone();
       //jQuery( 'body' ).html( html );
       //        jQuery( 'body' ).html( container );
       //        container.click( function () { jQuery( 'body' ).html( html ); } );
       },
       */

      /**
       * @summary generate instance configuration out of a HTML tag
       * @param {object} node - HTML tag
       * @returns {ccm.types.config}
       */
      generateConfig: function ( node ) {

        var config = {};
        catchAttributes( node, config );
        catchInnerTags( node );
        return config;

        function catchAttributes( node, obj ) {

          ccm.helper.makeIterable( node.attributes ).map( function ( attr ) {
            if ( attr.name !== 'src' ||
                ( node.tagName.indexOf( 'CCM-COMPONENT' ) !== 0
                && node.tagName.indexOf( 'CCM-INSTANCE'  ) !== 0
                && node.tagName.indexOf( 'CCM-PROXY'     ) !== 0 ) )
              try { obj[ attr.name ] = attr.value.charAt( 0 ) === '{' || attr.value.charAt( 0 ) === '[' ? JSON.parse( attr.value ) : prepareValue( attr.value ); } catch ( err ) {}
          } );

          function prepareValue( value ) {
            if ( value === 'true'      ) return true;
            if ( value === 'false'     ) return false;
            if ( value === 'null'      ) return null;
            if ( value === 'undefined' ) return undefined;
            if ( !isNaN( value )       ) return parseInt( value );
            return value;
          }

        }

        function catchInnerTags( node ) {

          config.childNodes = [];
          ccm.helper.makeIterable( node.childNodes ).map( function ( child ) {
            if ( child.tagName && child.tagName.indexOf( 'CCM-' ) === 0 ) {
              var split = child.tagName.toLowerCase().split( '-' );
              if ( split.length < 3 ) split[ 2 ] = split[ 1 ];
              switch ( split[ 1 ] ) {
                case 'load':
                  ccm.helper.deepValue( config, split[ 2 ], interpretLoadTag( child, split[ 2 ] ) );
                  break;
                case 'component':
                case 'instance':
                case 'proxy':
                  ccm.helper.deepValue( config, split[ 2 ], [ 'ccm.' + split[ 1 ], child.getAttribute( 'src' ) || split[ 2 ], ccm.helper.generateConfig( child ) ] );
                  break;
                case 'store':
                case 'dataset':
                  var settings = {};
                  catchAttributes( child, settings );
                  var key = settings.key;
                  delete settings.key;
                  ccm.helper.deepValue( config, split[ 2 ], [ 'ccm.' + split[ 1 ], settings, key ] );
                  break;
                case 'list':
                  var list = null;
                  ccm.helper.makeIterable( child.children ).map( function ( entry ) {
                    if ( entry.tagName && entry.tagName.indexOf( 'CCM-ENTRY' ) === 0 ) {
                      var split = entry.tagName.toLowerCase().split( '-' );
                      if ( !list )
                        list = split.length < 3 ? [] : {};
                      if ( split.length < 3 )
                        list.push( entry.getAttribute( 'value' ) );
                      else
                        ccm.helper.deepValue( list, split[ 2 ], entry.getAttribute( 'value' ) );
                    }
                  } );
                  if ( list ) ccm.helper.deepValue( config, split[ 2 ], list );
                  break;
                default:
                  config.childNodes.push( child );
                  node.removeChild( child );
              }
            }
            else {
              config.childNodes.push( child );
              node.removeChild( child );
            }
          } );

          function interpretLoadTag( node ) {

            var params = generateParameters( node );
            if ( !Array.isArray( params ) ) params = [ params ];
            params.unshift( 'ccm.load' );
            return params;

            function generateParameters( node ) {

              if ( node.hasAttribute( 'src' ) ) {
                if ( node.children.length === 0 )
                  return node.getAttribute( 'src' );
                var data = {};
                ccm.helper.makeIterable( node.children ).map( function ( child ) {
                  if ( child.tagName && child.tagName.indexOf( 'CCM-DATA-' ) === 0 )
                    data[ child.tagName.toLowerCase().split( '-' )[ 2 ] ] = child.getAttribute( 'value' );
                } );
                return [ node.getAttribute( 'src' ), data ];
              }
              var params = [];
              ccm.helper.makeIterable( node.children ).map( function ( child ) {
                if ( child.tagName === 'CCM-SERIAL' && ( node.tagName === 'CCM-PARALLEL' || node.tagName.indexOf( 'CCM-LOAD' ) === 0 )
                  || child.tagName === 'CCM-PARALLEL' && node.tagName === 'CCM-SERIAL' )
                  params.push( generateParameters( child ) );
              } );
              return params;

            }

          }

        }

      },

      /**
       * @summary generates a unique key
       * @description
       * An automatic generated unique key is made up of three parts.
       * The first part is the current time in milliseconds.
       * The second part is an 'X' as separator between first and last part.
       * The last part is a random number.
       * @returns {ccm.types.key} unique key
       * @example console.log( ccm.helper.generateKey() );  // 1465718738384X6869462723575014
       */
      generateKey: function () {

        return Date.now() + 'X' + Math.random().toString().substr( 2 );

      },

      /**
       * @summary get cursor position in a input field
       * @param {ccm.types.element} input - input field
       * @returns {number}
       */
      getCursor: function ( input ) {  // TODO: not a framework relevant helper function

        return input.get( 0 ).selectionStart;

      },

      /*
       * @summary ...
       * @returns {object}
       *
       getDateTime: function getDateTime( date, lang ) {

       if ( !date ) date = new Date();

       var result = {

       date: date,
       d:    date.getDate(),
       m:    date.getMonth() + 1,
       yyyy: date.getFullYear(),
       h:    date.getHours(),
       min:  date.getMinutes()

       };

       result.dd     = ( result.d   < 10 ? '0' : '' ) + result.d;
       result.mm     = ( result.m   < 10 ? '0' : '' ) + result.m;
       result.yy     = ( result.yyyy % 100 ) + '';
       result.hh     = ( result.h   < 10 ? '0' : '' ) + result.h;
       result.minmin = ( result.min < 10 ? '0' : '' ) + result.min;

       return result;

       },
       */

      /**
       * @summary get HTML DOM ID of the website area for the content of an <i>ccm</i> instance
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @returns {string}
       */
      getElementID: function ( instance ) {

        return 'ccm-' + instance.index;

      },

      /**
       * @summary generate HTML with JSON (recursive)
       * @param {ccm.types.html|ccm.types.html[]} html - <i>ccm</i> html data
       * @param {...string} [values] - values to replace placeholder
       * @returns {ccm.types.element|ccm.types.element[]} generated HTML
       */
      html: function( html, values ) {

        if ( ccm.helper.isNode( html ) ) return html;

        // replace placeholder
        if ( arguments.length > 1 ) html = ccm.helper.format.apply( this, arguments );

        // get more than one HTML tag?
        if ( Array.isArray( html ) ) {

          // generate each HTML tag
          var result = [];
          for ( var i = 0; i < html.length; i++ )
            result.push( ccm.helper.html( html[ i ] ) );       // recursive call
          return result;

        }

        // get string instead of ccm html data? => remove script tags
        if ( typeof html === 'string' || typeof html === 'number' ) return document.createTextNode( ccm.helper.noScript( html ) );

        // get no ccm html data? => return parameter value
        if ( typeof html !== 'object' ) return html;

        // has only key and inner property? => skip and continue with inner
        if ( Object.keys( html ).toString() === 'key,inner' )
          return ccm.helper.html( html.inner );                // recursive call

        /**
         * HTML tag
         * @type {ccm.types.element}
         */
        var element = document.createElement( ccm.helper.htmlEncode( html.tag || 'div' ) );

        // remove 'tag' and 'key' property
        delete html.tag; delete html.key;

        // iterate over ccm html data properties
        for ( var key in html ) {

          /**
           * value of ccm html data property
           * @type {string|ccm.types.html|Array}
           */
          var value = html[ key ];

          // interpret ccm html data property
          switch ( key ) {

            // HTML boolean attributes
            case 'async':
            case 'autofocus':
            case 'checked':
            case 'defer':
            case 'disabled':
            case 'ismap':
            case 'multiple':
            case 'readonly':
            case 'required':
            case 'selected':
              if ( value ) element.setAttribute( key, true );
              break;

            // inner HTML
            case 'inner':
              var children = this.html( value );  // recursive call
              if ( !Array.isArray( children ) )
                children = [ children ];
              for ( var i = 0; i < children.length; i++ )
                element.appendChild( children[ i ] );
              break;

            // HTML value attributes and events
            default:
              if ( key.indexOf( 'on' ) === 0 && typeof value === 'function' )  // is HTML event
                element.addEventListener( key.substr( 2 ), value );
              else                                                             // is HTML value attribute
                element.setAttribute( key, ccm.helper.htmlEncode( value ) );
          }

        }

        // return generated HTML
        return element;

      },

      /**
       * @summary HTML-encode a string
       * @see http://stackoverflow.com/questions/1219860/html-encoding-in-javascript-jquery
       * @param {string} value - string
       * @param {boolean} [trim=true] - .trim()
       * @param {boolean} [quot=true] - .replace( /"/g, '&quot;' )
       * @returns {string} HTML-encoded string
       */
      htmlEncode: function ( value, trim, quot ) {

        if ( typeof value !== 'string' ) value = value.toString();
        value = trim || trim === undefined ? value.trim() : value;
        value = document.createElement( 'a' ).appendChild( document.createTextNode( value ) ).parentNode.innerHTML;
        value = quot || quot === undefined ? value.replace( /"/g, '&quot;' ) : value;
        return value;

      },

      /**
       * @summary HTML-decode a sting
       * @see http://stackoverflow.com/questions/1219860/html-encoding-in-javascript-jquery
       * @param {string} value - string
       * @returns {string} HTML-decoded string
       */
      htmlDecode: function ( value ) {

        return jQuery( '<div>' ).html( value ).text();

      },

      /**
       * @summary integrate priority data into a given dataset
       * @description
       * Each value of each property in the given priority data will be set in the given dataset for the property of the same name.
       * This method also supports dot notation in given priority data to set a single deeper property in the given dataset.
       * With no given priority data, the result is the given dataset.
       * With no given dataset, the result is the given priority data.
       * @param {object} [priodata] - priority data
       * @param {object} [dataset] - dataset
       * @returns {object} dataset with integrated priority data
       * @example
       * var dataset  = { firstname: 'John', lastname: 'Doe', fullname: 'John Doe' };
       * var priodata = { lastname: 'Done', fullname: undefined };
       * var result = ccm.helper.integrate( priodata, dataset );
       * console.log( result );  // { firstname: 'John', lastname: 'Done', fullname: undefined };
       * @example
       * var result = ccm.helper.integrate( { foo: { a: 'x': b: 'y' } }, { 'foo.c': 'z' } );
       * console.log( result );  // { foo: { a: 'x', b: 'y', c: 'z' } }
       * @example
       * var result = ccm.helper.integrate( { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       * @example
       * var result = ccm.helper.integrate( undefined, { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       */
      integrate: function ( priodata, dataset ) {

        // no given priority data? => return given dataset
        if ( !priodata ) return dataset;

        // no given dataset? => return given priority data
        if ( !dataset ) return priodata;

        // iterate over priority data properties
        for ( var key in priodata ) {

          // set value for the same property in the given dataset
          ccm.helper.deepValue( dataset, key, priodata[ key ] );

        }

        // return dataset with integrated priority data
        return dataset;

      },

      /**
       * @summary check value for <i>ccm</i> component
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isComponent: function ( value ) {

        return ccm.helper.isObject( value ) && value.Instance && true;

      },

      /**
       * check value for <i>ccm</i> dataset
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isDataset: function ( value ) {

        return ccm.helper.isObject( value );

      },

      /**
       * check value for <i>ccm</i> datastore
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isDatastore: function ( value ) {

        return ccm.helper.isObject( value ) && value.get && value.set && value.del && true;

      },

      /**
       * check value if it is a <i>ccm</i> dependency
       * @param {*} value
       * @returns {boolean}
       * @example [ ccm.load, ... ]
       * @example [ ccm.component, ... ]
       * @example [ ccm.instance, ... ]
       * @example [ ccm.proxy, ... ]
       * @example [ ccm.render, ... ]
       * @example [ ccm.store, ... ]
       * @example [ ccm.dataset, ... ]
       */
      isDependency: function ( value ) {

        if ( Array.isArray( value ) )
          if ( value.length > 0 )
            switch ( value[ 0 ] ) {
              case ccm.load:
              case "ccm.load":
              case ccm.component:
              case "ccm.component":
              case ccm.instance:
              case "ccm.instance":
              case ccm.proxy:
              case "ccm.proxy":
              case ccm.render:
              case "ccm.render":
              case ccm.store:
              case "ccm.store":
              case ccm.dataset:
              case "ccm.dataset":
                return true;
            }

        return false;

      },

      /**
       * @summary check value for HTML element node
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isElementNode: function ( value ) {

        return !!( ccm.helper.isNode( value ) && value.tagName );

      },

      /**
       * @summary checks if a HTML element node exists in a DOM structure
       * @description
       * If <code>node</code> or <code>root</code> is an <i>ccm</i> instance, than the website area of this instance is used.
       * Returns <code>true</code> if <code>node</code> or <code>root</code> are equal.
       * @param {ccm.types.node|ccm.types.instance} node - HTML element node
       * @param {ccm.types.node|ccm.types.instance} [root] - root of the DOM structure that has to be checked, default is <code>document.body</code>
       * @returns {boolean}
       */
      isInDOM: function ( node, root ) {

        if ( ccm.helper.isInstance( node ) ) node = node.element;
        if ( ccm.helper.isInstance( root ) ) root = root.element;
        return ( root ? root : document.body ).contains( node );

      },

      /**
       * @summary check value for <i>ccm</i> instance
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isInstance: function ( value ) {

        return ccm.helper.isObject( value ) && value.component && true;

      },

      /**
       * @summary check value for HTML DOM Node
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isNode: function ( value ) {

        return value instanceof Node;

      },

      /**
       * check value if it is an object (including not null and not array)
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isObject: function ( value ) {

        return typeof value === 'object' && value !== null && !Array.isArray( value );

      },

      /**
       * check value if it is a ccm proxy instance
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isProxy: function ( value ) {

        return ccm.helper.isInstance( value ) && typeof value.component === 'string';

      },

      /**
       * @summary checks if an object is a subset of another object
       * @param {object} obj - object
       * @param {object} other - another object
       * @returns {boolean}
       */
      isSubset: function ( obj, other ) {

        for ( var i in obj )
          if ( typeof obj[ i ] === 'object' && typeof other[ i ] === 'object' ) {
            if ( JSON.stringify( obj[ i ] ) !== JSON.stringify( other[ i ] ) )
              return false;
          }
          else if ( obj[ i ] !== other[ i ] )
            return false;

        return true;

      },

      /**
       * @summary returns a <i>ccm</i> loading icon as HTML DOM Element
       * @types {ccm.types.node}
       */
      loading: function () {
        return ccm.helper.html( { class: 'ccm_loading', inner: { style: 'display: inline-block; width: 0.5em; height: 0.5em; border: 0.15em solid #009ee0; border-right-color: transparent; border-radius: 50%; animation: ccm_loading 1s linear infinite;' } } );
      },

      /**
       * @summary make something that's nearly array-like iterable (see examples)
       * @param array_like
       * @returns {Array}
       * @example
       * // makes arguments of a function iterable
       * ccm.helper.makeIterable( arguments ).map( function ( arg ) { ... } );
       * @example
       * // makes the children of a HTML DOM Node Element iterable
       * ccm.helper.makeIterable( document.getElementById( "dummy" ).children ).map( function ( child ) { ... } );
       * @example
       * // makes the attributes of a HTML DOM Node Element iterable
       * ccm.helper.makeIterable( document.getElementById( "dummy" ).attributes ).map( function ( attr ) { ... } );
       */
      makeIterable: function ( array_like ) {
        return Array.prototype.slice.call( array_like );
      },

      /**
       * @summary remove script tags in a string to prevent XSS attacks (XSS = Cross-Site-Scripting)
       * @param {string} string
       * @returns {string} string without script tags
       * @example
       * var string = 'Hello, world!<script type="text/javascript">alert("XSS");</script>'
       * var result = ccm.helper.noScript( string );
       * console.log( result );  // => 'Hello, world!'
       */
      noScript: function ( string ) {

        var tag = document.createElement( 'div' );
        tag.innerHTML = string;
        ccm.helper.makeIterable( tag.getElementsByTagName( 'script' ) ).map( function ( child ) {
          child.parentNode.removeChild( child );
        } );
        return tag.innerHTML;

      },

      /**
       * @summary privatizes public members of an <i>ccm</i> instance
       * @description
       * Deletes all given properties in a given <i>ccm</i> instance and returns an object with the deleted properties and there values.
       * If no properties are given, then all not <i>ccm</i> relevant instance properties will be privatized.
       * List of <i>ccm</i> relevant properties that could not be privatized:
       * <ul>
       *   <li><code>childNodes</code></li>
       *   <li><code>component</code></li>
       *   <li><code>element</code></li>
       *   <li><code>id</code></li>
       *   <li><code>index</code></li>
       *   <li><code>init</code></li>
       *   <li><code>onFinish</code></li>
       *   <li><code>parent</code></li>
       *   <li><code>ready</code></li>
       *   <li><code>render</code></li>
       * </ul>
       * In addition to this properties all depending <i>ccm</i> context relevant <i>ccm</i> instances will also not be privatized.
       * @param {ccm.types.instance} instance - <i>ccm</i> instance
       * @param {...string} [properties] - properties that have to privatized, default: privatizes all not <i>ccm</i> relevant properties
       * @returns {object} object that contains the privatized properties and there values
       * @example
       * // privatize two public instance members
       * ccm.component( {
       *   name: 'dummy1',
       *   config: { foo: 'abc', bar: 'xyz', baz: 4711 },
       *   Instance: function () {
       *     var self = this;
       *     var my;
       *     this.ready = function ( callback ) {
       *       my = ccm.helper.privatize( self, 'foo', 'bar' );
       *       console.log( my );                // => { foo: 'abc', bar: 'xyz' }
       *       console.log( my.foo, self.foo );  // => 'abc' undefined
       *       console.log( my.bar, self.bar );  // => 'xyz' undefined
       *       console.log( my.baz, self.baz );  // => undefined 4711
       *       callback();
       *     };
       *   }
       * } );
       * @example
       * // privatize all possible public instance members
       * ccm.component( {
       *   name: 'dummy2',
       *   config: { foo: 'abc', bar: 'xyz', baz: 4711 },
       *   Instance: function () {
       *     var self = this;
       *     var my;
       *     this.ready = function ( callback ) {
       *       my = ccm.helper.privatize();
       *       console.log( my );                // => { foo: 'abc', bar: 'xyz', baz: 4711 }
       *       console.log( my.foo, self.foo );  // => 'abc' undefined
       *       console.log( my.bar, self.bar );  // => 'xyz' undefined
       *       console.log( my.baz, self.baz );  // => 4711 undefined
       *       callback();
       *     };
       *   }
       * } );
       */
      privatize: function ( instance, properties ) {

        var obj = {};
        if ( properties )
          for ( var i = 1; i < arguments.length; i++ )
            privatizeProperty( arguments[ i ] );
        else
          for ( var key in instance )
            privatizeProperty( key )
        return obj;

        function privatizeProperty( key ) {
          switch ( key ) {
            case 'childNodes':
            case 'component':
            case 'element':
            case 'id':
            case 'index':
            case 'init':
            case 'onFinish':
            case 'parent':
            case 'ready':
            case 'render':
              break;
            default:
              if ( ccm.helper.isInstance( instance[ key ] ) && instance[ key ].parent && instance[ key ].parent.index === instance.index ) return;
              if ( instance[ key ] !== undefined ) obj[ key ] = instance[ key ];
              delete instance[ key ];
          }
        }

      },

      /**
       * @summary get a <i>ccm</i> relevant regular expression
       * @description
       * Possible index values, it's meanings and it's associated regular expressions:
       * <table>
       *   <tr>
       *     <th>index</th>
       *     <th>meaning</th>
       *     <th>regular expression</th>
       *   </tr>
       *   <tr>
       *     <td><code>'filename'</code></td>
       *     <td>filename for an <i>ccm</i> instance</td>
       *     <td>/^(ccm.)?([^.-]+)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/</td>
       *   </tr>
       *   <tr>
       *     <td><code>'key'</code></td>
       *     <td>key for a <i>ccm</i> dataset</td>
       *     <td>/^[a-z_0-9][a-zA-Z_0-9]*$/</td>
       *   </tr>
       * </table>
       * @param {string} index - index of the regular expression
       * @returns {RegExp} RegExp Object
       * @example
       * // test if a given string is a valid filename for an ccm instance
       * var string = 'ccm.dummy-3.2.1.min.js';
       * var result = ccm.helper.regex( 'filename' ).test( string );
       * console.log( result );  // => true
       * @example
       * // test if a given string is a valid key for a ccm dataset
       * var string = 'dummy12_Foo3';
       * var result = ccm.helper.regex( 'key' ).test( string );
       * console.log( result );  // => true
       */
      regex: function ( index ) {

        switch ( index ) {
          case 'filename': return /^ccm\.([^.-]+)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/;
          case 'key':      return /^[a-z_0-9][a-zA-Z_0-9]*$/;
        }

      },

      /**
       * @summary solves a <i>ccm</i> dependency
       * @param {object} obj - object that contains the <i>ccm</i> dependency
       * @param {number|string} key - object key that contains the <i>ccm</i> dependency
       * @param {function} [callback] - callback (first parameter is the result of the solved dependency)
       * @returns {*} result of the solved dependency (only of synchron)
       * @example
       * var obj = { layout: [ ccm.load, 'style.css' ] };
       * ccm.helper.solveDependency( obj, 'layout', function ( result ) {
       *   console.log( result );  // => 'style.css'
       * } );
       */
      solveDependency: function ( obj, key, callback ) {

        // given object not contains a ccm dependency at the given key? => abort and perform callback without a result
        if ( !ccm.helper.isDependency( obj[ key ] ) ) { if ( callback ) callback(); return; }

        // add a callback to the ccm action data of the ccm dependency
        obj[ key ].push( function ( result ) {
          obj[ key ] = result;                  // replace ccm dependency with the result of the solved dependency
          if ( callback) callback( result );
        } );

        // perform the ccm action data of the ccm dependency
        return ccm.helper.action( obj[ key ] );

      }

    }

  };

  /*---------------------------------------------- private ccm methods -----------------------------------------------*/

  /**
   * @summary get ccm datastore source
   * @private
   * @param {ccm.types.settings} settings - ccm datastore settings
   * @returns {string}
   */
  function getSource( settings ) {

    /**
     * ccm datastore source
     * @type {string|number}
     */
    var source = JSON.stringify( ccm.helper.filterProperties( settings, 'url', 'db', 'store' ) );

    // source is empty object? => use unique number as source
    if ( source === '{}' ) source = Object.keys( stores ).length;

    return source;
  }

  /*---------------------------------------------- ccm type definitions ----------------------------------------------*/

  /**
   * @namespace ccm.types
   * @summary <i>ccm</i> type definitions
   */

  /**
   * @typedef {function|string|Array} ccm.types.action
   * @summary <i>ccm</i> action data
   * @example function() { ... }
   * @example functionName
   * @example 'functionName'
   * @example 'my.namespace.functionName'
   * @example ['my.namespace.functionName','param1','param2']
   */

  /**
   * @typedef {namespace} ccm.types.component
   * @summary <i>ccm</i> component object
   * @description Below you see typically (but not all mandatory) properties. Most of these properties are set by the <i>ccm</i> framework.
   * @property {ccm.types.index} index - <i>ccm</i> component index
   * @property {ccm.types.name} name - <i>ccm</i> component name
   * @property {ccm.types.version} version - <i>ccm</i> component version number
   * @property {ccm.types.config} config - default configuration for own <i>ccm</i> instances
   * @property {function} Instance - constructor for creating <i>ccm</i> instances out of this component
   * @property {function} init - callback when this component is registered
   * @property {function} instance - creates an <i>ccm</i> instance out of this component
   * @property {function} render - creates and renders an <i>ccm</i> instance
   * @property {number} instances - number of own created <i>ccm</i> instances
   * @example {
   *   index:     'chat-2.1.3',
   *   name:      'chat',
   *   version:   [ 2, 1, 3 ],
   *   config:    {...},
   *   Instance:  function () {...},
   *   init:      function ( callback ) { ...; callback(); },
   *   instance:  function ( config, callback ) {...},
   *   render:    function ( config, callback ) {...},
   *   instances: 0
   * }
   */

  /**
   * @typedef {object} ccm.types.config
   * @summary <i>ccm</i> instance configuration
   * @description Below you see typically (but not mandatory) properties.
   * @property {ccm.types.element} element - <i>ccm</i> instance website area
   * @property {ccm.types.dependency} html - <i>ccm</i> datastore for html templates
   * @property {ccm.types.dependency} style - CSS styles for own website area
   * @property {string} classes - html classes for own website area
   * @property {ccm.types.dependency} store - <i>ccm</i> datastore that contains the dataset for rendering
   * @property {ccm.types.key} key - key of dataset for rendering
   * @property {ccm.types.dependency} lang - <i>ccm</i> instance for multilingualism
   * @property {ccm.types.dependency} user - <i>ccm</i> instance for user authentication
   * @example {
   *   element: jQuery( '#container' ),
   *   html:    [ ccm.store, { local: 'templates.json' } ],
   *   style:   [ ccm.load, 'style.css' ],
   *   classes: 'ccm-chat_snow'
   *   store:   [ ccm.store, { url: 'ws://ccm2.inf.h-brs.de/index.js', store: 'chat' } ],
   *   key:     'test',
   *   lang:    [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/lang.js', {
   *     store: [ ccm.store, 'translations.json' ]
   *   } ],
   *   user:    [ ccm.instance, 'https://kaul.inf.h-brs.de/ccm/components/user.js' ]
   * }
   */

  /**
   * @typedef {object} ccm.types.dataset
   * @summary <i>ccm</i> dataset
   * @description
   * Every <i>ccm</i> dataset has a property 'key' which contains the unique key of the dataset.
   * There are no conventions for other properties. They can be as they want.
   * @example {
   *   "key": "demo",
   *   "text": "Hello, World!",
   *   "value": "4711"
   * }
   * @example {
   *   "key": "my_first_video_rating",
   *   "likes": {                       // users which clicks like button
   *     "akless": true,
   *     "hunny84": true
   *   },
   *   "dislikes": {                    // user which clicks dislike button
   *     "negativguy": true
   *   }
   * }
   * @example {
   *   "key": "fruit_game_settings",
   *   "max_player": 2,
   *   "fruits": [
   *     {
   *       "name": "Apple",
   *       "points": 50
   *     },
   *     {
   *       "name": "Pear",
   *       "points": 30
   *     }
   *   ]
   * }
   */

  /**
   * @typedef {Object.<ccm.types.key, ccm.types.dataset>} ccm.types.datasets
   * @summary collection of <i>ccm</i> datasets
   * @example {
   *   "demo": {
   *     "key": "demo",
   *     "text": "Hello, World!",
   *     "value": "4711"
   *   },
   *   "test": {
   *     "key": "test",
   *     "text": "My test dataset.",
   *     "value": "abc"
   *   }
   * }
   */

  /**
   * @summary callback when an delete operation is finished
   * @callback ccm.types.delResult
   * @param {ccm.types.dataset} result - deleted dataset
   * @example function () { console.log( result ); }
   */

  /**
   * @typedef {ccm.types.action} ccm.types.dependency
   * @summary <i>ccm</i> dependency
   * @example [ ccm.component, 'ccm.chat.js' ]
   * @example [ ccm.instance, 'ccm.chat.js' ]
   * @example [ ccm.render, 'ccm.chat.js' ]
   * @example [ ccm.load, 'style.css' ]
   * @example [ ccm.store, { local: 'datastore.json' } ]
   * @example [ ccm.dataset, { local: 'datastore.json' }, 'test' ]
   */

  /**
   * @typedef {object} ccm.types.element
   * @summary "jQuery Element" object
   * @description For more informations about jQuery see ({@link https://jquery.com}).
   * @example var element = jQuery( 'body' );
   * @example var element = jQuery( '#menu' );
   * @example var element = jQuery( '.entry' );
   */

  /**
   * @callback ccm.types.getResult
   * @summary callback when a read operation is finished
   * @param {ccm.types.dataset|ccm.types.dataset[]} result - requested dataset(s)
   * @example function ( result ) { console.log( result ) }
   */

  /**
   * @typedef {object} ccm.types.html
   * @summary <i>ccm</i> html data - TODO: explain properties of <i>ccm</i> html data
   * @ignore
   */

  /**
   * @typedef {string} ccm.types.index
   * @summary <i>ccm</i> component index (unique in <i>ccm</i> framework)
   * @description An <i>ccm</i> component index is made up of a [component name]{@link ccm.types.name} and its [version number]{@link ccm.types.version}.
   * @example "blank-1.0.0"
   * @example "chat-2.1.3"
   * @example "blank" // no version number means latest version
   * @example "chat"
   */

  /**
   * @typedef {object} ccm.types.instance
   * @summary <i>ccm</i> instance
   * @property {number} id - <i>ccm</i> instance id (unique in own component)
   * @property {string} index - <i>ccm</i> instance index (unique in <i>ccm</i> framework)<br>A <i>ccm</i> instance index is made up of own [component name]{@link ccm.types.name} and own [id]{@link ccm.types.instance} (example: <code>"chat-1"</code>).
   * @property {ccm.types.component} component - reference to associated <i>ccm</i> component
   * @property {function} init - callback when this <i>ccm</i> instance is created and before dependencies of dependent resources are solved
   * @property {function} ready - callback when all dependencies of dependent resources are solved
   * @property {function} render - render content in own website area
   */

  /**
   * @typedef {object} ccm.types.JqXHR
   * @summary "jQuery XMLHttpRequest" object
   */

  /**
   * @typedef {string|number} ccm.types.key
   * @summary key of a <i>ccm</i> dataset (unique in the <i>ccm</i> datastore which contains the dataset)
   * @description Must be conform with the regular expression /^[a-z_0-9][a-zA-Z_0-9]*$/.
   * @example "test"
   * @example "_foo"
   * @example 4711
   * @example "1_ABC___4711"
   * @example "123"
   * @example "_"
   */

  /**
   * @typedef {string} ccm.types.name
   * @summary name of a <i>ccm</i> component (unique in a <i>ccm</i> component market place)
   * @description Must be conform with the regular expression /^[a-z][a-z_0-9]*$/.
   * @example "blank"
   * @example "chat"
   * @example "my_blank"
   * @example "chat2"
   * @example "bank_001"
   */

  /**
   * @typedef {object} ccm.types.node
   * @summary HTML DOM Node
   * @description For more informations see ({@link http://www.w3schools.com/jsref/dom_obj_all.asp}).
   */

  /**
   * @callback ccm.types.setResult
   * @summary callback when an create or update operation is finished
   * @param {ccm.types.dataset} result - created or updated dataset
   * @example function ( result ) { console.log( result ) }
   */

  /**
   * @typedef {object} ccm.types.settings
   * @summary <i>ccm</i> datastore settings
   * @description
   * Settings for a <i>ccm</i> datastore.
   * For more informations about providing a <i>ccm</i> datastore see the [documentation of the method 'ccm.store']{@link ccm.store}.
   * The data level in which the stored datasets will managed is dependent on the existing properties in the datastore settings.
   * No property 'store' results in a <i>ccm</i> datastore of data level 1.
   * An existing property 'store' results in a <i>ccm</i> datastore of data level 2.
   * An existing property 'store' and 'url' results in a <i>ccm</i> datastore of data level 3.
   * @property {ccm.types.datasets|ccm.types.url} local - Collection of initial <i>ccm</i> datasets or URL to a json file that deliver initial datasets for local cache.
   * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#data-caching} for more informations about this kind of data caching.
   * @property {string} store - Name of the datastore in the database.
   * Dependent on the specific database the datastore has different designations.
   * For example in IndexedDB this is the name of the Object Store, in MongoDB the name of the Document Store and in MySQL the name of the Table.
   * This property is not relevant for the first data level. It is only relevant for higher data levels.
   * @property {string} url - URL to an <i>ccm</i> compatible server interface.
   * This property is only relevant for the third data level.
   * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#server-interface} for more informations about an <i>ccm</i> compatible server interface.
   * @property {string} db - database (in case of a server that offers more than one database)
   * @property {function} onChange - Callback when server informs about changed stored datasets.
   * This property is only relevant for the third data level with real-time communication.
   * See [this wiki page]{@link https://github.com/akless/ccm-developer/wiki/Data-Management#real-time-communication} for more informations.
   * @property {ccm.types.instance} user - <i>ccm</i> instance for user authentication (not documented yet) | TODO: Wiki page for datastore security
   * @example
   * // provides a empty ccm datastore of data level 1
   * {}
   * @example
   * // provides a ccm datastore of data level 1 with initial datasets from a JSON file
   * {
   *   local: 'templates.json'
   * }
   * @example
   * // same example but cross domain
   * {
   *   local: 'http://akless.github.io/ccm-developer/resources/chat/templates.json'
   * }
   * // cross domain only works if json file looks like this: ccm.callback[ 'templates.json' ]( {...} );
   * @example
   * // provides a ccm datastore of data level 1 with directly given initial datasets
   * {
   *   local: {
   *     "demo": {
   *       "key": "demo",
   *       "text": "Hello, World!",
   *       "value": "4711"
   *     },
   *     "test": {
   *       "key": "test",
   *       "text": "My test dataset.",
   *       "value": "abc"
   *     }
   *   }
   * }
   * @example
   * // provides a ccm datastore of data level 2
   * {
   *   store: 'chat'
   * }
   * @example
   * // provides a ccm datastore of data level 3 using HTTP
   * {
   *   store: 'chat',                              // The file interface.php must be
   *   url: 'http://path/to/server/interface.php'  // an ccm compatible server interface
   * }
   * @example
   * // provides a ccm realtime datastore of data level 3 using WebSocket
   * {
   *   store: 'chat',                              // The file interface.php must be
   *   url: 'ws://path/to/server/interface.php',   // an ccm compatible server interface
   *   onChange: function () {
   *     console.log( arguments );  // Shows the server informations about changed
   *   }                            // stored datasets in the developer console.
   * }
   */

  /**
   * @typedef {string|object} ccm.types.source
   * @summary <i>ccm</i> datastore source - TODO: explain forms of <i>ccm</i> datasstore sources
   * @ignore
   */

  /**
   * @callback ccm.types.storeResult
   * @summary callback when a provided datastore is ready for use
   * @param {ccm.Datastore} store - <i>ccm<i/> datastore
   * @example function ( store ) { console.log( store ) }
   */

  /**
   * @typedef {string} ccm.types.url
   * @summary Uniform Resource Locator (URL)
   * @example https://github.com/akless/ccm-developer
   * @example ws://ccm2.inf.h-brs.de/index.js:80
   * @example http://akless.github.io/ccm-developer/resources/ccm.chat.min.js
   */

  /**
   * @typedef {number[]} ccm.types.version
   * @summary version number conform with Semantic Versioning 2.0.0 ({@link http://semver.org})
   * @example [1,0,0]
   * @example [2,1,3]
   */

}();