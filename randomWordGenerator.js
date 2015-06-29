var q = require('q')
var request = require('request')
var fs = require('fs')
var en = []
var de = []

exports.getRandomWord = function(language){
	var deferred = q.defer()
  if(language == 'en'){
    deferred.resolve(getRandomENWord())
  }else{
    deferred.resolve(getRandomDEWord())
  }

	return deferred.promise
}

exports.setup = function(){
	readLines(fs.createReadStream('./wortlisten/en.txt'),en)
	readLines(fs.createReadStream('./wortlisten/de.txt'),de)

}

function getRandomENWord(){
	return en[Math.floor(Math.random()*en.length)]
}


function getRandomDEWord(){
return de[Math.floor(Math.random()*de.length)]

}


function readLines(input,type) {
  var remaining = '';

  input.on('data', function(data) {
    remaining += data
    var index = remaining.indexOf('\n')
    while (index > -1) {
      var line = remaining.substring(0, index)
      remaining = remaining.substring(index + 1)
      type.push(line)
      index = remaining.indexOf('\n')
    }
  })

  input.on('end', function() {
    if (remaining.length > 0) {
    	type.push(remaining)
    }
  })
}

