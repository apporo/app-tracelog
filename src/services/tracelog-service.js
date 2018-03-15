'use strict';

var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('debug')('appTracelog:service');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;
  var pluginCfg = params.sandboxConfig;
  var LX = params.loggingFactory.getLogger();
  var TR = params.loggingFactory.getTracer();

  self.getRequestId = function(req) {
    return req && req[pluginCfg.tracingRequestName || 'requestId'];
  }

  var tracingPaths = lodash.get(pluginCfg, ['tracingPaths']);
  if (lodash.isString(tracingPaths)) tracingPaths = [ tracingPaths ];
  if (!lodash.isArray(tracingPaths)) tracingPaths = [];

  self.addTracingPaths = function(paths) {
    if (lodash.isEmpty(paths)) return;
    if (lodash.isString(paths)) paths = [paths];
    tracingPaths = lodash.union(tracingPaths, paths);
  }

  var tracingBoundary = function(req, res, next) {
    LX.isEnabledFor('debug') && LX.log('debug', TR.add({
      message: 'Request is coming',
      requestId: req[pluginCfg.tracingRequestName]
    }).toMessage());
    req.on('end', function() {
      LX.isEnabledFor('debug') && LX.log('debug', TR.add({
        message: 'Request has finished',
        requestId: req[pluginCfg.tracingRequestName]
      }).toMessage());
    });
    next();
  };

  self.getTracingBoundaryLayer = function(branches) {
    return {
      name: 'app-tracelog-boundary',
      path: tracingPaths,
      middleware: tracingBoundary,
      branches: branches
    }
  }

  var requestInterceptor = function(req, res, next) {
    req[pluginCfg.tracingRequestName] = req[pluginCfg.tracingRequestName] ||
        req.get(pluginCfg.tracingRequestHeader) || req.query[pluginCfg.tracingRequestName];
    if (!req[pluginCfg.tracingRequestName]) {
      req[pluginCfg.tracingRequestName] = TR.getLogID();
      LX.isEnabledFor('info') && LX.log('info', TR.add({
        message: 'RequestID is generated',
        requestId: req[pluginCfg.tracingRequestName]
      }).toMessage());
    }
    res.setHeader(pluginCfg.tracingRequestHeader, req[pluginCfg.tracingRequestName]);
    LX.isEnabledFor('info') && LX.log('info', TR.add({
      message: 'RequestID is set to response header',
      requestId: req[pluginCfg.tracingRequestName]
    }).toMessage());
    next();
  };

  self.getTracingListenerLayer = function(branches) {
    return {
      name: 'app-tracelog-listener',
      path: tracingPaths,
      middleware: requestInterceptor,
      branches: branches
    }
  }

  self.push = function(layerOrBranches, priority) {
    priority = (typeof(priority) === 'number') ? priority : pluginCfg.priority;
    params.webweaverService.push(layerOrBranches, priority);
  }

  if (pluginCfg.autowired !== false) {
    params.webweaverService.push([
      self.getTracingListenerLayer(),
      self.getTracingBoundaryLayer()
    ], pluginCfg.priority);
  }

  debugx.enabled && debugx(' - constructor end!');
};

Service.referenceList = [ "webweaverService" ];

module.exports = Service;
