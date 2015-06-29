var eclient = require('elasticsearch')
var q = require('q')
var gram = require('gramophone')
var fs = require('fs')
var _ = require('underscore')
var natural = require('natural')
var TfIdf = natural.TfIdf

var wordlist = {}
var documents = {}
var germanStopwords = fs.readFileSync('./germanStopwords.txt').toString().split(',')

var elasticClient = new eclient.Client({
    host: '192.168.42.54:9200'
})

var unique = function(origArr) {
    var newArr = [],
        origLen = origArr.length,
        found, x, y

    for (x = 0; x < origLen; x++) {
        found = undefined
        for (y = 0; y < newArr.length; y++) {
            if (origArr[x] === newArr[y]) {
                found = true
                break
            }
        }
        if (!found) {
            newArr.push(origArr[x])
        }
    }
    return newArr
}


function sortDocuments(docs){
    var deferred = q.defer()
    for (var i = docs.length - 1; i >= 0; i--) {
        var doc = docs[i]
        if(documents[doc.classification]){
            var arr = documents[doc.classification]
            arr.push(doc.text)
            documents[doc.classification] = arr
        }else{
            var arr = []
            arr.push(doc.text)
            documents[doc.classification] = arr
        }
        if(doc.text){

        var doctext = doc.text.replace(/\'/g,'')

        var words = gram.extract(doctext,{min:3, ngrams: [1,2], stopWords: germanStopwords})
       
            if(wordlist[doc.classification]){
                wordlist[doc.classification] = wordlist[doc.classification].concat(words)
            }else{
                wordlist[doc.classification] = words
            } 
        }              
    }
    var finalList = {}
    for(k in wordlist){
        var uniqueList = unique(wordlist[k])
        finalList[k] = uniqueList
    }
    var weights = {}
    for (k in finalList){
        tfidf = new TfIdf()
        for (var i = documents[k].length - 1; i >= 0; i--) {
            tfidf.addDocument(documents[k][i])
        }
        var measures = {}
        for (var i = finalList[k].length - 1; i >= 0; i--) {
            var word = finalList[k][i]
            var score = 0
            var doccount = 0
            tfidf.tfidfs(word,function(y,measure){
                doccount = y
                score += measure
            })
            measures[word] = score / doccount
        }
        weights[k] = measures
    }
    var results = {}

    for(k in weights){
        results[k] = []
            for(k2 in weights[k]){
                if(weights[k][k2] >= 3){
                    results[k].push(k2)
                }
            }
    }  
    deferred.resolve(results)
    console.log('Done generating keywords')
    return deferred.promise
}


function getDocuments(){
    var deferred = q.defer()
     elasticClient.search({
        index: 'sap_knowledgebase',
        type: 'brochures',
        size: 1000       /*** we just need any size bigger than doc count ***/
    }).then(function(r){
        if(r.hits.hits.length)
            deferred.resolve(r.hits.hits.map(function(brochure){
                return {
                    text: brochure._source.text,
                    classification: brochure._source.classification
                }
            }))
        else
            deferred.resolve('Retrieved empty docs array from elastic search...')
    }).catch(function(error){
       console.log('error while retrieving doc titles - ', error)
        deferred.reject(error)
    })
    return deferred.promise
}


exports.generateKeywords = function(){
    console.log('Start generating Keywords')
    var deferred = q.defer()
        getDocuments()
        .then(sortDocuments)
        .then(deferred.resolve)
    return deferred.promise
}


