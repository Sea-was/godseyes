var common = require('./common.js');

function route(url, res) {

  var pathname = common.url.parse(url).pathname;
  console.log("About to route a request for " + pathname);
  
  if (pathname === "/authenticate_user") {
  	var did = common.qs.parse(url)["deviceid"];
  	var desc = common.qs.parse(url)["desc"];
  	var p2p = common.qs.parse(url)["p2p"];
  	var force = common.qs.parse(url)["force"];
  	
  	//console.log("did:"+did+" p2p:"+p2p+" force:"+force);	
  	authenticateUser(did, desc, p2p, force, res);
  	
  } else if (pathname === "/user_session_started") {
  	var did = common.qs.parse(url)["deviceid"];
	  setUserStreaming(did, true);
  } else if (pathname === "/user_session_ended") {
  	var did = common.qs.parse(url)["deviceid"];
	  setUserStreaming(did, false);
  }
  
  else if (pathname === "/get_current_sessions") {
  	var streaming = common.qs.parse(url)["streaming"];
	  getCurrentSessions(streaming, res);
  }
}

//common.otSessionId

function authenticateUser(did, desc, p2p, force, res) {
	
	// if force flag, reset session automatically
	
	var p2pString = p2p ? 'enabled' : 'disabled';

	var tok = "";
	
	// note: forcing streaming to false
	if (force) { // force create new session
		newSession(p2pString, function(sessID) { 
			var tok = newToken(sessID); 
			updateUser(did, desc, sessID, tok, false, res);
		});
	} else {

		// check if in db already
		common.mongo.collection('users', function(e, c) {	
			c.findOne({'did':did}, function(err, doc) {
				if (doc) { 
						var tok = newToken(doc.sessionID);
						updateUser(did, desc, doc.sessionID, tok, false, res);
				} else {  // create new id
					newSession(p2pString, function(sessID) {
						var tok = newToken(sessID);
						updateUser(did, desc, sessID, tok, false, res);
					});
				}
			});
		});
	}							
}

function newSession(p2p, cb) {
	console.log("opening new session");
	// create opentok session
	var location = common.config.ip; // use an IP or 'localhost'
	common.opentok.createSession(location, {'p2p.preference':p2p}, function(result){
		console.log("session opened "+result);
		cb(result);
	});
}


var newToken = function(sessID) {
	var token = common.opentok.generateToken({session_id:sessID, 
		role:common.OpenTok.RoleConstants.PUBLISHER, 
		connection_data:"userId:42temp"}); //metadata to pass to other users connected to the session. (eg. names, user id, etc)
	return token;			
}


function updateUser(did, desc, sessID, tok, stream, res) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({did: did},
			{$set: {desc: desc, sessionID: sessID, token: tok, streaming: stream }}, 
			{upsert:true},
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated');
        
        // return json with tok + sessID
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify({ did:did, desc:desc, token:tok, sessionID:sessID, streaming: stream}));
        res.end();
    });
	});
}

function setUserStreaming(did, streaming) {
	common.mongo.collection('users', function(e, c) {
		// upsert user with tok + id
		c.update({did: did},
			{$set: {streaming: streaming}}, 
			function(err) {
        if (err) console.warn("MONGO ERROR "+err.message);
        else console.log('successfully updated user streaming '+streaming);
    });
	});	
}

function getCurrentSessions(streaming, res) {
	var args = {};
	if (streaming == 'true') args = {streaming:true};
	else if (streaming == 'false') args = {streaming:false};

	common.mongo.collection('users', function(e, c) {
		c.find(args).toArray(function(err, results) {
			console.log(results+" "+err);
        res.writeHead(200, { 'Content-Type': 'application/json' });   
        res.write(JSON.stringify(results));
        res.end();
        
        /*
common.fs.readFile('./views/test.html', function (err, html) {
       		res.writeHead(200, { 'Content-Type': 'text/html' });   
        	res.write(html);
        	res.end();
        });
*/
	    
        
		});
  });
}



exports.route = route;



