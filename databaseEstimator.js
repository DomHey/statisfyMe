var fs = require('fs')
var q = require('q')
var _ = require('lodash')
var randomWordHelper = require('./randomWordGenerator.js')
var request = require('request')
var htmlAnalyzer = require('./htmlAnalyzer.js')
var eclient = require('elasticsearch')
var RateLimiter = require('limiter').RateLimiter
//var predictionService = require('./elasticsearch-prediction.js')
randomWordHelper.setup()
var elasticClient = new eclient.Client({
    host: '192.168.42.54:9200'
})
var limiter = new RateLimiter(1, 300)


function makeSearchRequest(url){
	var deferred = q.defer()
	var url = url
	request.get(url, function(err,res,body){
		var results = []
		var nextSites = []
			htmlAnalyzer.getHtmlLinks(body)
			.then(deferred.resolve)
	})
  	return deferred.promise
}

function estimateDatabase(json){
	var deferred = q.defer()
	var documents = 0
	var doub = 0
	for(k in json){
		if(json[k] > 1){
			doub++
		}
		documents += json[k]
	}
	var unique = (documents-doub)
	console.log('overall docs: ' + documents)
	console.log('unique docs: ' +unique)
	console.log('doub docs: ' + doub)
	var OR = documents/unique
	var div = Math.pow(OR,-1.1)

	deferred.resolve(unique/(1-div))
	return deferred.promise

}

function estimateProductDatabase(json){
	var deferred = q.defer()
	var documents = 0
	var doub = 0
	for(k in json){
		if(json[k] > 1){
			doub++
		}
		documents += json[k]
	}
	var unique = (documents-doub)
	console.log('overall docs: ' + documents)
	console.log('unique docs: ' +unique)
	console.log('doub docs: ' + doub)
	var OR = documents/unique
	var div = Math.pow(OR,-0.8)

	deferred.resolve(unique/(1-div))
	return deferred.promise

}

exports.databaseCorpusPromise = function(language,count,orgcount,url){
	var deferred = q.defer()
	var corpus = {}
	startDatabaseEstimation(corpus,language,url,deferred,count,orgcount)
	return deferred.promise
}

function startDatabaseEstimation(corpus,language,url,promise,count,orgcount){
	setTimeout(function(){
		if(count > 0){
			process.stdout.write('Queried ' + count + ' / '+orgcount+' searchterms\033[0G')
			randomWordHelper.getRandomWord(language)
			.then(function(word){
			makeSearchRequest(url+word)
				.then(function(res){
					for (var i = res.length - 1; i >= 0; i--) {
						var link = res[i]
						if(!corpus[link]){
							corpus[link] = 1
						}else{
							corpus[link] = corpus[link] + 1
						}
					}

					count --
					startDatabaseEstimation(corpus,language,url,promise,count,orgcount)
				})
			})
				
		}else{
			var result = {}

			for(k in corpus){
				if(!(corpus[k] > (orgcount / 2))){
					result[k] = corpus[k]
				}
			}

			fs.writeFileSync('corpusoutput.txt',JSON.stringify(result),null,2)

			estimateDatabase(result)
				.then(function(res){
					console.log('Database is: ' +res + ' docs')
					promise.resolve()
				})
		}
	},500)
}

exports.productCorpusPromise = function(url,product,words){
	console.log("startProductDatabaseEstimation: " + product)
	console.log("found : " + words.length + " Keywords")
	var deferred = q.defer()
	var corpus = {}
	startProductDatabaseEstimation(corpus,url,product,words,0,deferred)
	return deferred.promise
}


function startProductDatabaseEstimation(corpus,url,product,words,index,promise){
	setTimeout(function(){
		var s
		if(words.length > 100){
			s = 100
		}else{
			s = words.length
		}
		if(index < words.length && index < 100){
			process.stdout.write('Queried ' + index + ' / '+s+' searchterms\033[0G')
			var word = words[index]
			makeSearchRequest(url+word)
			.then(function(res){
						for (var i = res.length - 1; i >= 0; i--) {
							var link = res[i]
							if(!corpus[link]){
								corpus[link] = 1
							}else{
								corpus[link] = corpus[link] + 1
							}
						}
						index = index +1
						startProductDatabaseEstimation(corpus,url,product,words,index,promise)
					})
				}else{
					var result = {}

					for(k in corpus){
						if(!(corpus[k] > (words.length / 2))){
							result[k] = corpus[k]
						}
					}

					fs.writeFileSync(product+'corpusoutput.txt',JSON.stringify(result),null,2)
					resolveProductCategories(product,result)
				}
		},500)
}

function resolveProductCategories(product,result){
	var promises = []
	var c = 0
	for (k in result){
			//process.stdout.write('Evaluated ' + c + ' / ' +result.length + ' posts\033[0G')
			var link = k.replace('href="/','')
			link = link.replace('"','')
				promises.push(downloadPostContent(product,link))
	}

	q.allSettled(promises).then(function(){
		var finalCorpus = {}
		var res = []
		
		for (var i = 0; i < promises.length; i++) {
			var p = promises[i]
			if(p.isFulfilled()){
				res.push(p.inspect().value)
			}

		}

		if(res.length == 0){
			console.log('No documents for ' + product + ' found!')
		}else{
		}
		for (var i = res.length - 1; i >= 0; i--) {
			var id = res[i]
			var id = 'href="/' + id+'"'
			finalCorpus[id] = result[id]
			fs.writeFileSync(product+'FINALcorpusoutput.txt',JSON.stringify(finalCorpus),null,2)
			

		}

			estimateProductDatabase(finalCorpus)
						.then(function(res){
							console.log(product+' Database is: ' +res + ' docs')
							promise.resolve(res)
						})

	})

}

function downloadPostContent(product,id){
var deferred = q.defer()
	limiter.removeTokens(1, function() {
		elasticClient.search({
			index: 'sap_post*',
			type: 'post',
			fields: ['title' , 'summary'],
			body:{
				query: {
					match: {_id: id}
				}
			}
		}).then(function(res){
			//console.log('res: ' +res)
			if(res){
				if(res.hits.hits){
				if(res.hits.hits[0]){
					var title = res.hits.hits[0].fields.title[0]
					var summary = res.hits.hits[0].fields.summary[0]
					var text = title + summary
					checkProduct(text,product)
					.catch(console.log)
					.then(function(res){
						process.stdout.write('Evaluated ' + id + '\033[0G')
						//console.log('Database Est repsonse : ' + res)
						if(res == product){
							deferred.resolve(id)
						}else{
							deferred.reject()
						}
					})
				}else{
					deferred.reject()
				}
				}else{
					deferred.reject()
				}
			}else{
				deferred.reject()
			}
		})
	})
	return deferred.promise
}


function checkProduct(content,product){
	var deferred = q.defer()
	//var headers = {"Authorization" : "Basic U1lTVEVNOno0SG0zTDdn"}

	var url = 'http://192.168.42.54:9001/predictions?text=' + content
	request.get({url: url}, function(e,r,b){
		try{
			var json = JSON.parse(b)
			if(e){
				deferred.resolve('none')
			}else{
				if(json.product[0].product == product){
					deferred.resolve(product)
				}else{
					deferred.resolve('none')
				}
			}
			
		}catch(e){
			deferred.resolve('none')
		}
	})

	return deferred.promise
}