var http = require('http')
var dispatcher = require('httpdispatcher')
var fs = require('fs')
var mailer = require("nodemailer")
var eclient = require('elasticsearch')
var q = require('q')
var username, password, email
var config = require('../config.js')

var elasticClient = new eclient.Client({
    host: '192.168.42.54:9200'
})

//Lets define a port we want to listen to
const PORT = 12345


//Create a server
var server = http.createServer(handleRequest)

//Lets start our server
server.listen(PORT, function(){
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Server listening on: http://localhost:%s", PORT)
})

function handleRequest(request, response){
    try {
        //log the request on console
        console.log(request.url)
        //Disptach
        dispatcher.dispatch(request, response)
    } catch(err) {
        console.log(err)
    }
}

dispatcher.onGet("/register", function(req, res) {
    fs.readFile('register.html',function (err, data){
	    res.writeHead(200, {'Content-Type': 'text/html'})
	    res.write(data)
	    res.end()
    })
})

dispatcher.onGet("/main", function(req, res) {
    fs.readFile('main.html',function (err, data){
	    res.writeHead(200, {'Content-Type': 'text/html'})
	    res.write(data)
	    res.end()
    })
})

dispatcher.onPost("/reg", function(req, res) {
	console.log(req.params)
	username = req.params.fname
	password = req.params.pwd
	email = req.params.email
	sendVerificationEmail(email)
    res.writeHead(302, {'Content-Type': 'text/plain', 'Location': '/login'})
    res.end()
})

dispatcher.onGet("/login", function(req, res) {
    fs.readFile('login.html',function (err, data){
	    res.writeHead(200, {'Content-Type': 'text/html'})
	    res.write(data)
	    res.end()
    })
})


dispatcher.onPost("/api/test", function(req, res) { 
        console.log(JSON.stringify(req.params))
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.write(JSON.stringify(req.params))
        res.end()

})



dispatcher.onPost("/log", function(req, res) {
	console.log('loginattempt: ' + JSON.stringify(req.params))
    console.log('successfull login form: ' + req.params.email)
    console.log('send 302 for redirect to /main')
	res.writeHead(302, {'Content-Type': 'text/html', 'Location':'/main'})
	res.end()
  
})

dispatcher.onGet("/search", function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'})
    var results = searchDataBaseForWord(req.params.q)
    .then(function(results){
        if(results.length > 0){
            var temp = ''
        for (var i = results.length - 1; i >= 0; i--) {
            temp += '<a href="/'+ results[i] +'">Link</a>'
            temp += '</br>'
        }
            temp +='<a href="/shouldberemovedLink">REMOVELINK</a>'
            temp += '</br>'
            res.write(temp)
        }else{
            var temp = ''
            temp +='<a href="/shouldberemovedLink">REMOVELINK</a>'
            temp += '</br>'
            temp += "<h1> No valid Data found </h1>"
            res.write(temp)
        }

        res.end()
        
    })
  
})


dispatcher.onGet("/validateUser", function(req, res) {
    console.log('validate:  ' )
    console.log(req.params.user)
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.end()
})




function sendVerificationEmail(email){
	   var smtpTransport = mailer.createTransport({
        service: "Gmail",
        auth: {
            user: config.emailName,
            pass: config.emailPass
        }
    })
	console.log('send verification email to : ' + email)
	var html = '"http://localhost:12345/validateUser?user='+email+'"'
    var mail = {
        from: "Dominik von der Heydt" + "<" +config.emailName+">",
        to: email,
        subject: "Validation",
        text: "Validate your Useraccount",
        html: '<a href='+html+'>verify your account</a>'
    }

    smtpTransport.sendMail(mail, function(error, response){
        if(error){
            console.log(error)
        }else{
            console.log("Message sent: " + response.message)
        }

        smtpTransport.close()
    })
}


function searchDataBaseForWord(word){
    var deferred = q.defer()
    elasticClient.search({
        index: 'sap_post*',
        type: 'post',
        size: 20,
        body: {
            query: {
                bool: {
                    must:[{match: {source:'linkedin'}}],
                    should: [
                        { match: { title: { query: word, boost: 5 }}},
                        { match: { summary: { query: word, boost: 1 }}}
                    ], 
                    minimum_should_match: 1
                }
            }
        }
    }).then(function(results){
        if (results.hits.hits) {
            var links = []
            for (var i = results.hits.hits.length - 1; i >= 0; i--) {
                links.push(results.hits.hits[i]._id)
            }
            deferred.resolve(links)
        }else{
            deferred.resolve([])
        }
    })
    return deferred.promise
}
