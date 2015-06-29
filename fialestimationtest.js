var fs = require('fs')

var json = JSON.parse(fs.readFileSync('LVMFINALcorpusoutput.txt'))
var documents = 0
var doub = 0
for(k in json){
	if(json[k] > 1){
		doub++
	}
	documents += json[k]
}
console.log(documents)
console.log(doub)

var unique = (documents-doub)

var OR = documents/unique
console.log(OR)

var div = Math.pow(OR,-0.8)
console.log(div)

console.log(unique/(1-div))