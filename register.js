var request = require('request')
var j = request.jar()
var $ = require('cheerio')
var q = require('q')
var _ = require('underscore')
var htmlString
var htmlparser = require('htmlparser2')
var fs = require('fs')
var emailadress
var baseUrl 
var registerUrl

exports._start_register = function(url, username, pass){
	var deferred = q.defer()
	request.get({url: url}, function(err,res,body){
		htmlString = body
		baseUrl = url.match(/http(s)*:\/\/.*?\//g)

		baseUrl = baseUrl[0].substring(0,baseUrl[0].length-1)
		console.log(baseUrl)
		_get_mail_address()
		.then(function(){
			var deferred = q.defer()
			deferred.resolve(_analyse_register_form(_pick_register_form(_get_register_forms()),username,pass))
			return deferred.promise
		})
		.then(makePostRequest)
		.then(console.log)
		.catch(console.log)
		.then(createPromise)
		.then(function(){
			deferred.resolve(emailadress)
		})
	})
	return deferred.promise
}





function _analyse_register_form(form,username,pass){
	var deferred = q.defer()
	form = form[0]
	var postData = {}
	var userField
	var emailField
	var passwordField
	var method = form.attribs.method
	var action = form.attribs.action
	registerUrl = baseUrl + action
	var inputs = $('input',form)

	for (var i = inputs.length - 1; i >= 0; i--) {
		var input = inputs[i]
		var scoreUsername = 0, scoreEmail = 0,scorePassword = 0, scoreCheckbox=0
		if(input.attribs.type == 'hidden'){
			postData[input.attribs.name] = input.attribs.value
		}else{
			if(input.attribs.type == 'password'){
				scorePassword += 20
			}

			for(k in input.attribs){
				if(input.attribs[k].toLowerCase().indexOf('password') > -1){
					scorePassword += 10
				}

				if(input.attribs[k].toLowerCase().indexOf('email') > -1){
					scoreEmail += 10
				}

				if(input.attribs[k].toLowerCase().indexOf('login') > -1){
					scoreUsername += 10
				}

				if(input.attribs[k].toLowerCase().indexOf('username') > -1){
					scoreUsername += 10
				}

				if(input.attribs.type == 'checkbox'){
					scoreCheckbox +=100
				}
			}

			var decision = {user: scoreUsername, pass: scorePassword, email: scoreEmail, checkbox: scoreCheckbox}
			var index
			var tempScore = -1
			for (k in decision){
				if(decision[k] > tempScore){
					tempScore = decision[k]
					index = k
				}
			}
			if(input.attribs.name){

				if(index == 'user'){
				//	userField = input
					postData[input.attribs.name] =username
				}
				if(index =='pass'){
					//passwordField = input
					postData[input.attribs.name] =pass
				}
				if(index == 'email'){
					postData[input.attribs.name] =emailadress
					//emailField = input
				}

				if(index == 'checkbox'){
					postData[input.attribs.name] = 'on'
				}
			}

		}
	}
	/*if(userField.attribs){
    	postData[userField.attribs.name] = username
	}

	if(emailField.attribs){
    	postData[emailField.attribs.name] = emailadress	
	}

	if(passwordField.attribs){
    	postData[passwordField.attribs.name] = pass		
	}*/
	console.log(postData)
	deferred.resolve(postData)
	return deferred.promise

}

function _pick_register_form(mapping){
	var index = 0
	for (k in mapping){
		if(k > index){
			index = k
		}
	}
	return mapping[index]
}

function _get_register_forms(){
	htmlString = $.load(htmlString)
	var mapping = {}
	htmlString('form').map(function(i,form) {
		var score = _rate_register_form(form)
		if(!mapping[score]){
			mapping[score] = []
		}
		mapping[score].push(form)
	})
	return mapping
}

function _rate_register_form(form){
	//todo rate form by name if contains user , register, signup etc
	score = 0
	if(form.attribs.action == '/join' || form.attribs.action == '/register'){
		score += 30
	}

	for(k in form.attribs){
		if((form.attribs[k]).toLowerCase().indexOf('signup') > -1){
			score += 10
		}
	}

	return score
}

function _query_all_registration_links(link){
	var deferred = q. defer()
		request.get({url: link}, function(err,res,body){
			deferred.resolve(emailadress)
		})
	return deferred.promise
}

function _get_mail_content(url,promise){
	console.log(url)
	var htmlString

	request.get({url: url, jar: j }, function(err,res,body){
	htmlString  = $.load(body)
	var tab = htmlString('#tabs-3')
	var links = $('[href]',tab)
	var emailLinks = []

	for (k in links){
		if(links[k].attribs){
			if(links[k].attribs.href){
				emailLinks.push(links[k].attribs.href)
			}
		}
	}
	var promises = [] 
	for (var i = emailLinks.length - 1; i >= 0; i--) {
		var link = emailLinks[i]
		promises.push(_query_all_registration_links(link))
		console.log('clicked: ' + link)
	}
	q.all(promises).then(function(){
		promise.resolve()
	})
	})


}

function _query_new_mails(promise){
	var url
	request.get({url: 'https://10minutemail.net/', jar: j }, function(err,res,body){
		var table = ($('#mailbox-table tr',body))
		if(table['2']){
			var link = table['2'].attribs.onclick
			console.log(link)
			link = link.replace("location=","")
			link = link.replace(/'/g,"")
			url = 'https://10minutemail.net/' + link
			_get_mail_content(url, promise)
		}else{
			console.log('No new emails')
			setTimeout(function(){_query_new_mails(promise)},5000)
		}
	})
}

function _get_mail_address(){
	var def = q.defer()
	request.get({url: 'https://10minutemail.net/', jar: j }, function(err,res,body){
		def.resolve($('#fe_text',body).val())
		emailadress = ($('#fe_text',body).val())
		console.log(($('#fe_text',body).val()))
	})
	return def.promise

}

function createPromise(){
	var deferred = q.defer()
	_query_new_mails(deferred)
	return deferred.promise
}

function makePostRequest(json){
	console.log('make post request')
	var deferred = q.defer()
	console.log('registerurl: ' +registerUrl)
	request.post({url: registerUrl, form: json}, function(err,res,body){
		if(res.statusCode == 200 || res.statusCode == 302){
			console.log('registered')
			deferred.resolve()
		}else{
			deferred.resolve()	
		}
	})
	deferred.resolve()
  	return deferred.promise
}


