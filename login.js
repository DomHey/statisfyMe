var htmlparser = require('htmlparser2')
var fs = require('fs')
var $ = require('cheerio')
var mapping = {}
var q = require('q')

exports._try_login = function(EMAIL,USER,PASS,URL,BODY){
	var deferred = q.defer()
	var result = _join_login_information(EMAIL,USER,PASS,URL,BODY)
	deferred.resolve(result)
	return deferred.promise
}

function _join_login_information(EMAIL,USER,PASS,URL,BODY){
var parsedHTML = $.load(BODY)
parsedHTML('form').map(function(i, form) {
  form = $(form)
  var formScore = _form_score(form)
  if(!mapping[formScore]){
  	mapping[formScore] = [form]
  }else{
  	mapping[formScore] = mapping[formScore].push(form)
  }
  
})
	var maxScore = 0
	for(var k in mapping){
		if(k > maxScore){
			maxScore = k
		}
	}

	var loginForm = mapping[maxScore]
	loginForm = loginForm['0']

	var loginFields = _pick_fields(loginForm)

	var additionalData = _get_hidden_data(loginForm)

	var baseUrl = URL.match(/http(s)*:\/\/.*?\//g)

	var path = baseUrl[0].substring(0,baseUrl[0].length-1) + loginForm['0'].attribs.action

	var method = loginForm['0'].attribs.method

	var formData = _create_form_data(loginFields,additionalData,EMAIL, USER, PASS)
	var returnData = {'formData': formData, 'method': method, 'path': path}
	return JSON.stringify(returnData)
}

function _create_form_data(loginFields,additionalData,EMAIL,USERNAME,PASSWORD){
	var formData = {}
	console.log('Email: ' + EMAIL)

	if(loginFields.emailfield){
		formData[loginFields.emailfield.attribs.name] = EMAIL
	}

	if(loginFields.userfield){
		formData[loginFields.userfield.attribs.name] = USERNAME
	}

	if(loginFields.passfield){
		formData[loginFields.passfield.attribs.name] = PASSWORD
	}

	for(k in additionalData){
		formData[k] = additionalData[k]
	}

	return formData

}

function _get_hidden_data(form){
	var additionalFormData = {}
	var hiddenInputs = $('input',form)
	for (var i = hiddenInputs.length - 1; i >= 0; i--) {
		var hi = hiddenInputs[i]
			if(hi.attribs.type == 'hidden'){
				additionalFormData[hi.attribs.name] = hi.attribs.value
			}
	}
	return additionalFormData
}

function _form_score(form){
	var score = 0
	var total = {}
	inputFields = $( 'input', form )
	if(inputFields >= 2 && inputFields <=4){
		score +=10
	}

	for (var i = inputFields.length - 1; i >= 0; i--) {
		var inp = inputFields[i]
		if(inp.attribs.type == 'text' && inp.attribs.name == 'email'){
			if(!total['textemail']){
				total['textemail'] = 1
			}else{
				total['textemail'] ++				
			}
			if(!total['text']){
				total['text'] = 1
			}else{
				total['text'] ++				
			}
		}else if(inp.attribs.type == 'text'){
			if(!total['text']){
				total['text'] = 1
			}else{
				total['text'] ++				
			}
		}else if(inp.attribs.type == 'password' && inp.attribs.name =='password'){
			if(!total['textpassword']){
				total['textpassword'] = 1
			}else{
				total['textpassword'] ++			
			}
			if(!total['password']){
				total['password'] = 1
			}else{
				total['password']  ++				
			}
		}else if(inp.attribs.type == 'password'){
			if(!total['password']){
				total['password'] = 1
			}else{
				total['password']  ++				
			}
		}else if(inp.attribs.type == 'checkbox'){
			if(!total['checkbox']){
				total['checkbox'] = 1
			}else{
				total['checkbox'] ++				
			}
		}else if(inp.attribs.type == 'radio'){
			if(!total['radio']){
				total['radio'] = 1
			}else{
				total['radio'] ++			
			}
		}
	}

	if(!total['text']){
		score -=10
	}else{
		score +=10
	}

	if(!total['password']){
		score -=10
	}else if(total['password'] == 1){
		score +=10
	}

	if(total['checkbox'] > 1){
		score -=10
	}else if(total['checkbox'] == 1){
		score +=10
	}

	if(total['radio']){
		score -=10
	}

	if(total['textemail'] = 1){
		score +=20
	}

	if(total['textpassword'] == 1 && total['textemail'] == 1 && total['checkbox'] == 1){
		score +=50
	}

	return score

}

function _pick_fields(form){
	var userfield,passfield,emailfield
	inputFields = $( 'input', form )

	for (var i = inputFields.length - 1; i >= 0; i--) {
		var input = inputFields[i]
		if(input.attribs.type == 'password' && !passfield){
			passfield = input
		}
		if(input.attribs.type == 'text' && !userfield){
			userfield = input
		}
		if(input.attribs.type == 'email' && !emailfield){
			emailfield = input
		}	

	}

	return {emailfield: emailfield, userfield: userfield, passfield: passfield}
}