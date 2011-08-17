///  <reference path="tds.js" /> 

//pre-reqs
var net = require('net');
var util = require('util');
var assert = require('assert');
var TdsBuilder = require('../lib/tds.js').TdsBuilder

var connectionStringDefault = { Server: '127.0.0.1', Port: '1433', Database: 'master', Login: 'sa', Password: '', Timeout: 10000 };

var SqlConnection = function(connString, callback) {
    assert.ok(arguments.length !== 0, "Connection String is missing!");

    var it = this;
    it.IsConnected = false;
    it.IsExecuting = false;
    it.Version = {};

    console.log("connecting ...");

    //
    // Check parameters and initialize them
    //
    it.ConnectionString = connString || connectionStringDefault;
    for (var key in connectionStringDefault)
        it.ConnectionString[key] = it.ConnectionString[key] || connectionStringDefault[key];


    //
    // Create a Connection to get MS SQL Version
    //

    net.createConnection(it.ConnectionString.Port, it.ConnectionString.Server, function() {
        var buffer = TdsBuilder.HandshakeRequest();
        var res = it.socket.end(buffer);
    }).on("data", function(data) {
        it.Version = TdsBuilder.HandshakeResponse(data).Version;
        console.log("My Version is " + util.inspect(it.Version));
    });

    //
    // Create other Connection
    //
    it.socket = net.createConnection(it.ConnectionString.Port, it.ConnectionString.Server, function() {
        var buffer = TdsBuilder.LoginRequest(it.ConnectionString.Login, it.ConnectionString.Password, it.ConnectionString.Database);
        var res = it.socket.write(buffer);
    }).on("data", function(data) {
        console.log("Open(callback) End " + data.length);
        callback && callback.call(it);
    });

    // TIMEOUT
    it.socket.setTimeout(it.ConnectionString.Timeout);
    it.socket.on("timeout", function() { console.log("timeout"); it.Close(); });

    //
    // Events
    //    
    //this.socket.on("drain", function(data) { console.log("drain"); });
    //it.socket.on("error", function(err) { console.log("error: " + err); });
    //this.socket.on("close", function(data) { console.log("close"); });    
    //this.socket.on("end", function(data) { console.log("end"); });
    //this.socket.on("connect", function(data) { console.log("connect"); });
    //this.socket.connect(this.ConnectionString.Port, this.ConnectionString.Server);



    return it;
}

SqlConnection.prototype.Close = function() {
    console.log("Close()");
    this.socket.end();
}

SqlConnection.prototype.ExecuteQuery = function ExecuteQuery(query) {
    if (isConnected && !isExecuting) {
        //do I even need to do this?
        isExecuting = true;

        var buff = Tds.ExecuteQuery(query);
        var res = client.write(buff);

        //done
        isExecuting = false;
    }
}

exports.SqlConnection = SqlConnection;