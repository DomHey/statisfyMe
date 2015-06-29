var q = require('q')



exports.getHtmlLinks = function(body){
	var deferred = q.defer()
	var links = []
	links = body.match(/href="\/.*?"/g)
	var result = []
    if(links){
		for (var i = links.length - 1; i >= 0; i--) {
				if(links[i].indexOf('?') < 0){
					result.push(links[i])
				}	
		}
	}

	deferred.resolve(result)
	return deferred.promise

}