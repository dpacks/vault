const DPack = require('@dpack/core')
const tempy = require('tempy')

exports.distributeDPack = function (dir) {
  return new Promise((resolve, reject) => {
    DPack(dir, {temp: true}, function (err, dpack) {
      if (err) return reject(err)
      dpack.joinNetwork()
      dpack.importFiles(dir, function (err) {
        if (err) return reject(err)
        resolve(dpack)
      })
    })
  })
}

exports.createDPack = function () {
  return new Promise((resolve, reject) => {
    DPack(tempy.directory(), {temp: true}, function (err, dpack) {
      if (err) return reject(err)
      dpack.joinNetwork()
      resolve(dpack)
    })
  })
}
