var $ = require('cheerio')
var htmlparser = require('htmlparser2')
var fs = require('fs')
var request = require('request').defaults({jar: true})
var q = require('q')

var detect = require('cld')
var htmlAnalyzer = require('./htmlAnalyzer.js')
var corpus = {}
var orgcount = 500
var count = 500
var language = 'de'

var keywordGenerator = require('./generateKeywords.js')
var loginHelper = require('./login.js')
var searchHelper = require('./search.js')
var registerHelper = require('./register.js')
var databaseEstimator = require('./databaseEstimator.js')

var searchurl = ''


/*var url = process.argv[2]
var baseUrl = url.match(/http(s)*:\/\/.*?\//g)
baseUrl = baseUrl[0].substring(0,baseUrl[0].length-1)
var username = process.argv[3]
var pwd = process.argv[4]*/

var loginUrl, registerUrl, username, pwd, email


for (var i = process.argv.length - 1; i > 1; i--) {
  var arg = process.argv[i].split('=')

  switch (arg[0]) {
    case '--loginUrl': loginUrl = arg[1]; break;
    case '--registerUrl': registerUrl = arg[1]; break;
    case '--userName': username = arg[1]; break;
    case '--pass': pwd = arg[1]; break;
    case '--email' :email = arg[1]; break;
    default: console.log('Bad parameter:', arg); process.exit(0); break;
  }
}
var baseUrl = loginUrl.match(/http(s)*:\/\/.*?\//g)
baseUrl = baseUrl[0].substring(0,baseUrl[0].length-1)

if(registerUrl && username && pwd){
	attemptRegister()
}else{
	attemptLogin(email)
}

//queryDatabaseForProduct()

function attemptRegister(){
	registerHelper._start_register(registerUrl,username,pwd)
		.then(attemptLogin)
}

function attemptLogin(emaila){
email = emaila
console.log("returned email " + email)
makeGetRequest(loginUrl)
	.then(function(body){
		var deferred = q.defer()
		var result = loginHelper._try_login(email,username,pwd,loginUrl,body)
 
		deferred.resolve(result)
		return deferred.promise
	})
	.then(function(json){
		var deferred = q.defer()
		var json = JSON.parse(json)
		deferred.resolve(JSON.stringify({'formData' : json.formData, 'url' : json.path}))
		return deferred.promise
	})
	.then(makePostRequest)
	.then(searchHelper._return_search_form)
	.then(function(json){
		console.log(json)
		var deferred = q.defer()
		searchurl = baseUrl + json.action + '?' + json.name +'='
		
		//detectSiteLanguage() TODO
		deferred.resolve(databaseEstimator.databaseCorpusPromise('en',count,orgcount,searchurl))
		return deferred.promise

	})

	.then(queryDatabaseForProduct)
	.then(console.log)
	.catch(console.log)
}

function makePostRequest(json){
	var deferred = q.defer()
	var pJson = JSON.parse(json)
	var url = pJson.url
	console.log(url)
	var formData = pJson.formData
	console.log(formData)
	request.post({url: url, form: formData}, function(err,res,body){
		if(res.statusCode == 302){
			var redirect = res.headers['location']
			console.log('redirected')
			followRedirect(redirect)
				.then(deferred.resolve)
		}else{
			deferred.resolve(body)	
		}
	})
  	return deferred.promise
}


function followRedirect(url){
	console.log('redirecturl: ' + url)
	var deferred = q.defer()
	request.get(baseUrl + url, function(err,res,body){
		deferred.resolve(body)
	})
  	return deferred.promise

}

function makeGetRequest(url){
	console.log('getrequest ' + url)
	var deferred = q.defer()
	request.get(url, function(err,res,body){
		deferred.resolve(body)
	})
  	return deferred.promise
}



function detectSiteLanguage(url){
	var deferred = q.defer()
	var url = url
	request.get(url, function(err,res,body){
		var options = {isHTML:true}
		detect.detect(body,options,function(err,result){
			language = result.languages[0].code
			deferred.resolve(result.languages[0].code)
		})

	})
	return deferred.promise
}



function queryDatabaseForProduct(){
keywordGenerator.generateKeywords()
	.then(function(res){
		console.log('query for products')
		//for(k in res){
		//	databaseEstimator.productCorpusPromise(searchurl,k,res[k])
		//}
		databaseEstimator.productCorpusPromise(searchurl,'LVM',res['LVM'])
	})
}