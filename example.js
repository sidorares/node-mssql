var mssql = require('./lib/mssql');

//try a connection
var connectionString = { Server: "127.0.0.1", Port: 1433, Database: "master", Login: "sa", Password: "yyy", Timeout: 15000 };
var conn = new mssql.SqlConnection(connectionString, function() {
    //this.Open(function() { console.log(this.Version); this.Close(); });
});





