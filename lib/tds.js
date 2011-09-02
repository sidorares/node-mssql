var util = require("util");
var assert = require("assert");


///	<summary>
///		TdsBuilder
///	</summary>
///	<param name="data" type="Buffer" optional="true" />
function TdsBuilder() {

    this.offset = 0;
    this.buffer = new Buffer(0xFFFF);

    /* packet type: prelogin */
    this.buffer.writeUInt8(0x00, this.offset, true); this.offset += 1;
    /* packet status: 'normal' */
    this.buffer.writeUInt8(0x01, this.offset, true); this.offset += 1;
    /* packet length */
    this.buffer.writeUInt16(0x00, this.offset, true); this.offset += 2;
    /* packet spid is the process id on the server side. we don't care. */
    this.buffer.writeUInt16(0x00, this.offset, true); this.offset += 2;
    /* packet id: only one here. */
    this.buffer.writeUInt8(0x01, this.offset, true); this.offset += 1;
    /* window id: just the one, again. */
    this.buffer.writeUInt8(0x00, this.offset, true); this.offset += 1;


    this.packetData = [];
}


///	<summary>
///		addHeaderPacket
///	</summary>
///	<param name="messageType" type="Number" />
///	<returns type="void" />
TdsBuilder.prototype.addHeaderPacket = function(messageType) {
    if (arguments.length === 0) throw new Error("The 'messageType' argument is missing!");

    this.buffer[0] = messageType;
};




///	<summary>
///		addData
///	</summary>
///	<param name="messageType" type="Number" />
///	<returns type="void" />
TdsBuilder.prototype.addData = function(data) {
    if (arguments.length === 0) throw new Error("The 'data' argument is missing!");
    if (!data || typeof (data) !== "object") throw new Error("The 'data' argument is not a Buffer!");

    for (var i in data) {
        /* window id: just the one, again. */
        this.buffer.writeUInt8(data[i], this.offset, true); this.offset += 1;
    }
};

///	<summary>
///		Add token 
///	</summary>
///	<param name="id" type="Number" />
///	<param name="data" type="Array" /> 
///	<returns type="void" />
TdsBuilder.prototype.addPacketData = function(data, endian, encoding) {
    assert.ok(arguments.length - 1 in [0, 1, 2], "The arguments is wrong, 3 is needed but " + arguments.length + " was found!");

    var packetDataItem = [data, this.offset, endian, encoding];
    /* 0x00, 0x00 only fills space*/
    this.buffer.writeUInt16(0x00, this.offset, true); this.offset += 2;
    /* 0x00, 0x00 only fills space*/
    this.buffer.writeUInt16(0x00, this.offset, true); this.offset += 2;

    this.packetData.push(packetDataItem);
};


///	<summary>
///		Convert in the Buffer object 
///	</summary>
///	<returns type="Buffer" />
TdsBuilder.prototype.toBuffer = function() {
    var bufferOrArray,
        offset,
        endian,
        encoding,
        length;

    for (var i in this.packetData) {
        bufferOrArray = this.packetData[i][0];
        offset = this.packetData[i][1];
        endian = this.packetData[i][2] || 'big';
        encoding = this.packetData[i][3] || 'utf8';

        if (typeof (bufferOrArray) === "string") {
            bufferOrArray = new Buffer(bufferOrArray, encoding);
        }

        length = bufferOrArray.length;
        if (encoding === "ucs2") { length = parseInt(length / 2); /* UNICODE characters has double length */ }

        //
        // Update position and length
        //
        this.buffer.writeUInt16(this.offset - 8, offset, endian === 'big');
        this.buffer.writeUInt16(length, offset + 2, endian === 'big');


        if (Buffer.isBuffer(bufferOrArray)) {
            bufferOrArray.copy(this.buffer, this.offset);
            this.offset += bufferOrArray.length; /* Advance to TRULY length */
            continue;
        }

        if (typeof (bufferOrArray) === "object") {
            for (var j in bufferOrArray) {
                this.buffer.writeUInt8(bufferOrArray[j], this.offset, endian === 'big'); this.offset += 1;
            }
            continue;
        }


    }

    // Copy current buffer to new small buffer     
    var buf = new Buffer(this.offset);
    this.buffer.copy(buf, 0, 0, this.offset);
    buf[3] = buf.length;

    return buf;

};


///	<summary>
///		This is the first thing every good TDS server endpoint expects. My version 
///     only sends the basic existance stuff, but there's half a dozen options, or 
///     'tokens' you could specify here. specifically of interest is encryption.
///	</summary>
///	<param name="useMars" type="Number" />
///	<returns type="Buffer" />
TdsBuilder.HandshakeRequest = function(useMars) {
    var msg = new TdsBuilder();
    // 0x12 - Handshake
    msg.addHeaderPacket(0x12);
    // 0 - VERSION
    msg.addData([0x00]);
    msg.addPacketData([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    // 1- ENCRYPTION  ->  0-Off / 1-On / 2-NOT_SUP / 3-REQ
    msg.addData([0x01]);
    msg.addPacketData([0x00]);
    // 2 - INSTOPT
    msg.addData([0x02]);
    msg.addPacketData([0x00]);
    // 3 - THREADID
    msg.addData([0x03]);
    msg.addPacketData([0x00, 0x00, 0x00, 0x00]);
    // 4 - MARS 0-Off / 1-On
    msg.addData([0x04]);
    msg.addPacketData([useMars || 0x01]);

    msg.addData([0xFF]); // Terminator

    var buf = msg.toBuffer();

    buf.writeUInt8(buf.length, 3, true);

    //return new Buffer([0x12, 0x01, 0x00, 0x2F, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1A, 0x00, 0x06, 0x01, 0x00, 0x20,0x00, 0x01, 0x02, 0x00, 0x21, 0x00, 0x01, 0x03, 0x00, 0x22, 0x00, 0x04, 0x04, 0x00, 0x26, 0x00,0x01, 0xFF, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0xB8, 0x0D, 0x00, 0x00, 0x01]);



    return buf;
}

///	<summary>
///		This is the response that server sent, contains some information like your version 
///	</summary>
///	<param name="buffer" type="Buffer" />
///	<returns type="Object" />
TdsBuilder.HandshakeResponse = function(buffer) {
    assert.ok(arguments.length === 1, "The argument 'buffer' is missing!");
    assert.ok(buffer[0] === 0x04, "This buffer is not Server Response or type bit not is 0x04!")

    var offset = 0;
    offset += 8; // Header Packet length
    offset += 5; // VERSION Token=1 + Offset=2 + length=2
    offset += 5; // ENCRYPTION Token=1 + Offset=2 + length=2
    offset += 5; // INSTOPT Token=1 + Offset=2 + length=2
    offset += 5; // THREADID Token=1 + Offset=2 + length=2
    offset += 5; // MARS Token=1 + Offset=2 + length=2
    offset += 1; // Terminator

    var tmp = buffer.slice(offset);

    return {
        Version: {
            Major: tmp.readUInt8(0, true),
            Minor: tmp.readUInt8(1, true),
            Revision: tmp.readUInt16(2, true) // 6->0x6, 64->0x40 = 0x640 = 1600
        },
        UseEncrypt: tmp.readUInt16(4, true)
    };
}

///	<summary>
///		This is the response that server sent, contains some information like your version 
///	</summary>
///	<param name="username" type="String" />
///	<param name="password" type="String" />
///	<param name="database" type="String" />
///	<returns type="Buffer" />
TdsBuilder.LoginRequest = function(username, password, database/* , hostname, appname */) {

    var msg = new TdsBuilder();
    // 0x12 - Handshake
    msg.addHeaderPacket(0x10);

    msg.addData([0, 0, 0, 0]); // Length

    // SQL Server Version
    // Version Sent from Client to Server
    // 7.0  -> 0x00000070
    // 2000 -> 0x00000071
    // 2005 -> 0x02000972
    // 2008 -> 0x03000A73
    // 2008 -> 0x03000B73
    // SQL Server Denali -> 0x04000074
    msg.addData([0x03, 0, 0x0A, 0x73]); // 2008 TDS version

    msg.addData([0, 0x10, 0, 0]); // PacketSize
    msg.addData([0, 0, 0, 0x7]); // Client Prog ver
    msg.addData([0, 0x1, 0, 0]); // Client Process ID
    msg.addData([0, 0, 0, 0]); // Connection ID

    // Option Flag 1
    msg.addData([0xE0]);
    // Option Flag 2
    msg.addData([0x03]);
    // Type Flags
    msg.addData([0]);
    // Option Flag 3
    msg.addData([0]);

    // ClientTimZone
    msg.addData([0xE0, 0x01, 0, 0]); // 480
    // Client LCID
    msg.addData([0x09, 0x04, 0, 0]); // 1033

    // ibHostname + cchHostname
    var hostname = arguments[3] || require("os").hostname();
    msg.addPacketData(hostname, endian = 'little', encoding = 'ucs2');
    // ibUsername + cchUsername
    msg.addPacketData(username, endian = 'little', encoding = 'ucs2');
    // ibPassword + cchPassword
    msg.addPacketData(password, endian = 'little', encoding = 'ucs2');
    // ibAppname + cchAppname
    var appName = arguments[4] || "node-mssql";
    msg.addPacketData(appName, endian = 'little', encoding = 'ucs2');
    // ibServerName + cchServerName
    msg.addPacketData(new Buffer(0), endian = 'little');
    // ibUnused + cbUnused
    msg.addPacketData(new Buffer(0), endian = 'little');
    // ibCltintName + cbCltIntName
    msg.addPacketData("ODBC", endian = 'little', encoding = 'ucs2');
    // ibLanguage + cbLanguage
    msg.addPacketData(new Buffer(0), endian = 'little');
    // ibDatabase + cbDatabase
    msg.addPacketData(database, endian = 'little', encoding = 'ucs2');

    //
    // Client ID
    //
    //<BYTES>00 50 8B E2 B7 8F </BYTES>
    msg.addData([0x00, 0x50, 0x8b, 0xE2, 0xB7, 0x8f]);

    // ibSSPI + cbSSPI
    msg.addPacketData(new Buffer(0), endian = 'little');

    // ibAtchDBFile + cbAtchDBFile
    msg.addPacketData(new Buffer(0), endian = 'little');

    // ibChangePassword + cchChangePassword
    msg.addPacketData(new Buffer(0), endian = 'little');

    //<cbSSPILong>
    //<LONG>00 00 00 00 </LONG>
    //</cbSSPILong>
    msg.addData([0x00, 0x00, 0x00, 0x00]);

    var buf = msg.toBuffer();

    buf.writeUInt8(buf.length, 3, false);
    buf.writeUInt32(buf.length - 8, 8, false);


    //return new Buffer([0x10, 0x01, 0x00, 0x90, 0x00, 0x00, 0x01, 0x00, 0x88, 0x00, 0x00, 0x00, 0x02, 0x00, 0x09, 0x72, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xE0, 0x03, 0x00, 0x00, 0xE0, 0x01, 0x00, 0x00, 0x09, 0x04, 0x00, 0x00, 0x5E, 0x00, 0x08, 0x00, 0x6E, 0x00, 0x02, 0x00, 0x72, 0x00, 0x00, 0x00, 0x72, 0x00, 0x07, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x80, 0x00, 0x04, 0x00, 0x88, 0x00, 0x00, 0x00, 0x88, 0x00, 0x00, 0x00, 0x00, 0x50, 0x8B, 0xE2, 0xB7, 0x8F, 0x88, 0x00, 0x00, 0x00, 0x88, 0x00, 0x00, 0x00, 0x88, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x73, 0x00, 0x6B, 0x00, 0x6F, 0x00, 0x73, 0x00, 0x74, 0x00, 0x6F, 0x00, 0x76, 0x00, 0x31, 0x00, 0x73, 0x00, 0x61, 0x00, 0x4F, 0x00, 0x53, 0x00, 0x51, 0x00, 0x4C, 0x00, 0x2D, 0x00, 0x33, 0x00, 0x32, 0x00, 0x4F, 0x00, 0x44, 0x00, 0x42, 0x00, 0x43, 0x00]);

    return buf;
}


/*
** Login Response is a token stream, then needs read the token and read your content, read next token and so on
*/
TdsBuilder.LoginResponse = function(buffer) {
    assert.ok(arguments.length === 1, "The argument 'buffer' is missing!");
    assert.ok(buffer[0] === 0x04, "This buffer is not Server Response or type bit not is 0x04!");

    var offset = 8; /* header length*/
    var response = {
        envchange: [],
        info: []
    };

    while (offset < buffer.length) {

        var token = buffer.readUInt8(offset, false); offset += 1;

        //
        // ENVCHANGE
        //
        if (token === 0xE3) {
            var length = buffer.readUInt16(offset, false); offset += 2;
            var type = buffer.readUInt8(offset, false); //offset += 1;

            var data = buffer.slice(offset, offset + length); offset += length;

            response.envchange.push({ type: type, offset: offset, length: length, data: data });
        }



        //
        // INFO
        //
        if (token === 0xAB) {
            var info = {};
            info.length = buffer.readUInt16(offset, false); offset += 2;
            info.number = buffer.readUInt32(offset, false); //offset += 4;
            info.state = buffer.readUInt8(offset, false); //offset += 1;
            info.classType = buffer.readUInt8(offset, false); //offset += 1;
            info.msgLength = buffer.readUInt16(offset, false); //offset += 2;
            info.msg = buffer.toString('utf8', offset + 4 + 1 + 1 + 2, offset + 4 + 1 + 1 + 2 + info.length).replace(/\u0000/g,''); offset += info.length;

            response.info.push(info);
        }


        //return response;
    }


    console.log(response);
    return response;
}

exports.ExecuteQuery = function ExecuteQuery(query) {
    var query_packet = new Buffer(9);
    //packet type: SQL Batch
    query_packet[0] = 0x1;

    //packet status: 'normal'
    query_packet[1] = 0x0;

    //packet length:
    query_packet[2] = 0x0;
    query_packet[3] = 0x08;

    //packet spid is the process id on the server side. we don't care.
    query_packet[4] = 0x0;
    query_packet[5] = 0x0;

    //packet id: only one here.
    query_packet[6] = 0x01;

    //window id: just the one, again.
    query_packet[7] = 0x00;


    var buffer = new Buffer(query, encoding = 'utf8');
    buffer.copy(query_packet, 8, 0, buffer.length);

    query_packet[8 + buffer.length] = 0xFF;

    return query_packet;
}


exports.TdsBuilder = TdsBuilder




//
// Utility functions
//
Buffer.prototype.toArray = function() {
    var list = [];
    for (var i = 0; i < this.length; i++) list.push(this[i]);
    return list;
}

function Encrypt(pwdBuffer) {
    var tmp = [];
    tmp.push(pwdBuffer[0], pwdBuffer[1], pwdBuffer[2], pwdBuffer[3]);
    return pwdBuffer;
}

exports.Encrypt = Encrypt;