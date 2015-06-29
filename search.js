var $ = require('cheerio')
var htmlparser = require('htmlparser2')
var fs = require('fs')
var q = require('q')
//var htmlString = fs.readFileSync('github.txt').toString()
//htmlString = $.load(htmlString)
var htmlString

exports._return_search_form = function(body){
	var deferred  = q.defer()
	htmlString = $.load(body)
	_get_input_forms(htmlString)
		.then(_analyze_search_form)
		.then(deferred.resolve)
	return deferred.promise
}


function _get_input_forms(body){
	var deferred  = q.defer()
	var mapping = {}
	body('form').map(function(i, form) {
		if(form.attribs.method == 'get'){
			var inputs = $('input',form)
				for (var i = inputs.length - 1; i >= 0; i--) {
					var input = inputs[i]
					var score = _rate_input_form(input)
					if(!mapping[score]){
						mapping[score] = []
					}
					mapping[score].push({form: form , input: input})
				}
		}
	})
	deferred.resolve(mapping)
	return deferred.promise
}


function _rate_input_form(input){
	var score = 0
	if(input.attribs.name =='q'){
		score +=20
	}
	for (k in input.attribs){
		if( (input.attribs[k].toLowerCase()).indexOf('search') > -1 ){
			score += 10
		}
	}
	return score
}

function _analyze_search_form(mapping){
	var deferred  = q.defer()
	var index = 0
	for (k in mapping){
		if (k > index){
			index = k
		}
	}

	var o = mapping[index]
	var form = o[0].form
	var input = o[0].input

	var action = form.attribs.action
	var name = input.attribs.name
	deferred.resolve({action: action, name: name})
	return deferred.promise
}