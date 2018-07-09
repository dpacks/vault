const test = require('ava')
const os = require('os')
const path = require('path')
const fs = require('fs')
const tempy = require('tempy')
const {distributeDPack, createDPack} = require('./lib/dpack-helpers')
const DPackVault = require('../')

var testStaticDPack, testStaticDPackURL
var createdVault
var fakeDPackURL = 'dweb://' + ('f'.repeat(64)) + '/'
var dbrowserPng = fs.readFileSync(__dirname + '/scaffold/dpack-static-test/dbrowser.png')

test.before(async t => {
  // distribute the test static dPack
  testStaticDPack = await distributeDPack(__dirname + '/scaffold/dpack-static-test')
  testStaticDPackURL = 'dweb://' + testStaticDPack.vault.key.toString('hex') + '/'
})

// tests
//

test('vault.readdir', async t => {
  var vault = new DPackVault(testStaticDPackURL)

  // root dir
  let listing1 = await vault.readdir('/')
  t.deepEqual(listing1.sort(), ['dbrowser.png', 'hello.txt', 'subdir'])

  // subdir
  let listing2 = await vault.readdir('/subdir')
  t.deepEqual(listing2.sort(), ['hello.txt', 'space in the name.txt'])

  // root dir stat=true
  let listing3 = await vault.readdir('/', {stat: true})
  listing3 = listing3.sort()
  t.is(listing3[0].name, 'dbrowser.png')
  t.truthy(listing3[0].stat)
  t.is(listing3[1].name, 'hello.txt')
  t.truthy(listing3[1].stat)
  t.is(listing3[2].name, 'subdir')
  t.truthy(listing3[2].stat)

  // subdir stat=true
  let listing4 = await vault.readdir('/subdir', {stat: true})
  listing4 = listing4.sort()
  t.is(listing4[0].name, 'hello.txt')
  t.truthy(listing4[0].stat)
  t.is(listing4[1].name, 'space in the name.txt')
  t.truthy(listing4[1].stat)
})

test('vault.readFile', async t => {
  var vault = new DPackVault(testStaticDPackURL)

  // read utf8
  var helloTxt = await vault.readFile('hello.txt')
  t.deepEqual(helloTxt, 'hello world')

  // read utf8 2
  var helloTxt2 = await vault.readFile('/subdir/hello.txt', 'utf8')
  t.deepEqual(helloTxt2, 'hi')

  // read utf8 when spaces are in the name
  var helloTxt2 = await vault.readFile('/subdir/space in the name.txt', 'utf8')
  t.deepEqual(helloTxt2, 'hi')

  // read hex
  var dbrowserPngHex = await vault.readFile('dbrowser.png', 'hex')
  t.deepEqual(dbrowserPngHex, dbrowserPng.toString('hex'))

  // read base64
  var dbrowserPngBase64 = await vault.readFile('dbrowser.png', 'base64')
  t.deepEqual(dbrowserPngBase64, dbrowserPng.toString('base64'))

  // read binary
  var dbrowserPngBinary = await vault.readFile('dbrowser.png', 'binary')
  t.truthy(dbrowserPng.equals(dbrowserPngBinary))

  // timeout: read an vault that does not exist
  var badVault = new DPackVault(fakeDPackURL)
  await t.throws(badVault.readFile('hello.txt', { timeout: 500 }))
})

test('vault.stat', async t => {
  var vault = new DPackVault(testStaticDPackURL)

  // stat root file
  var entry = await vault.stat('hello.txt')
  t.deepEqual(entry.isFile(), true, 'root file')

  // stat subdir file
  var entry = await vault.stat('subdir/hello.txt')
  t.deepEqual(entry.isFile(), true, 'subdir file')

  // stat subdir
  var entry = await vault.stat('subdir')
  t.deepEqual(entry.isDirectory(), true, 'subdir')

  // stat non-existent file
  await t.throws(vault.stat('notfound'))

  // stat alt-formed path
  var entry = await vault.stat('/hello.txt')
  t.deepEqual(entry.isFile(), true, 'alt-formed path')

  // stat path w/spaces in it
  var entry = await vault.stat('/subdir/space in the name.txt')
  t.deepEqual(entry.isFile(), true, 'path w/spaces in it')

  // stat path w/spaces in it
  var entry = await vault.stat('/subdir/space%20in%20the%20name.txt')
  t.deepEqual(entry.isFile(), true, 'path w/spaces in it')

  // timeout: stat an vault that does not exist
  var badVault = new DPackVault(fakeDPackURL)
  await t.throws(badVault.stat('hello.txt', { timeout: 500 }))
})

test('DPackVault.create', async t => {
  // create it
  createdVault = await DPackVault.create({
    title: 'The Title',
    description: 'The Description'
  })

  // check the dpack.json
  var manifest = JSON.parse(await createdVault.readFile('dpack.json'))
  t.deepEqual(manifest.title, 'The Title')
  t.deepEqual(manifest.description, 'The Description')
})

test('vault.configure', async t => {
  // configure it
  await createdVault.configure({
    title: 'The New Title',
    description: 'The New Description'
  })

  // check the dpack.json
  var manifest = JSON.parse(await createdVault.readFile('dpack.json'))
  t.deepEqual(manifest.title, 'The New Title')
  t.deepEqual(manifest.description, 'The New Description')
})

test('vault.writeFile', async t => {
  async function dotest (filename, content, encoding) {
    // write to the top-level
    await createdVault.writeFile(filename, content, encoding)

    // read it back
    var res = await createdVault.readFile(filename, encoding)
    if (encoding === 'binary') {
      t.truthy(content.equals(res))
    } else {
      t.deepEqual(res, content)
    }
  }

  var dbrowserPng = fs.readFileSync(__dirname + '/scaffold/dpack-static-test/dbrowser.png')
  await dotest('hello.txt', 'hello world', 'utf8')
  await dotest('dbrowser1.png', dbrowserPng, 'binary')
  await dotest('dbrowser2.png', dbrowserPng.toString('base64'), 'base64')
  await dotest('dbrowser3.png', dbrowserPng.toString('hex'), 'hex')
})

test('vault.writeFile gives an error for malformed names', async t => {
  await t.throws(createdVault.writeFile('/', 'hello world'))
  await t.throws(createdVault.writeFile('/subdir/hello.txt/', 'hello world'))
  await t.throws(createdVault.writeFile('hello`.txt', 'hello world'))
})

test('vault.writeFile protects the manifest', async t => {
  await t.throws(createdVault.writeFile('dpack.json', 'hello world'))
})

test('vault.mkdir', async t => {
  await createdVault.mkdir('subdir')
  var res = await createdVault.stat('subdir')
  t.deepEqual(res.isDirectory(), true)
})

test('vault.writeFile writes to subdirectories', async t => {
  await createdVault.writeFile('subdir/hello.txt', 'hello world', 'utf8')
  var res = await createdVault.readFile('subdir/hello.txt', 'utf8')
  t.deepEqual(res, 'hello world')
})

test('versioned reads and writes', async t => {
  // create a fresh dPack
  var vault = await DPackVault.create({title: 'Another Test DPack'})

  // do some writes
  await vault.writeFile('/one.txt', 'a', 'utf8')
  await vault.writeFile('/two.txt', 'b', 'utf8')
  await vault.writeFile('/one.txt', 'c', 'utf8')

  // check history
  var history = await vault.history()
  if (history.length !== 4) {
    console.log('Weird history', history)
  }
  t.deepEqual(history.length, 4)

  // helper
  function checkout (v) {
    return new DPackVault(vault.url + v)
  }

  // read back versions
  t.deepEqual((await checkout('+1').readdir('/')).length, 1)
  t.deepEqual((await checkout('+2').readdir('/')).length, 2)
  t.deepEqual((await checkout('+3').readdir('/')).length, 3)
  t.deepEqual((await checkout('+2').readFile('/one.txt')), 'a')
  t.deepEqual((await checkout('+4').readFile('/one.txt')), 'c')
  var statRev2 = await checkout('+2').stat('/one.txt')
  var statRev4 = await checkout('+4').stat('/one.txt')
  t.truthy(statRev2.offset < statRev4.offset)
})

test('Fail to write to unowned vaults', async t => {
  var vault = new DPackVault(testStaticDPackURL)
  await t.throws(vault.writeFile('/denythis.txt', 'hello world', 'utf8'))
  await t.throws(vault.mkdir('/denythis'))
})

test('vault.getInfo', async t => {
  var vault = new DPackVault(testStaticDPackURL)
  var info = await vault.getInfo()
  t.deepEqual(info.isOwner, false)
  t.deepEqual(info.version, 4)
})

test('vault.download', async t => {
  var vault = new DPackVault(testStaticDPackURL)

  // ensure not yet downloaded
  var res = await vault.stat('/hello.txt')
  t.deepEqual(res.downloaded, 0)

  // download
  await vault.download('/hello.txt')

  // ensure downloaded
  var res = await vault.stat('/hello.txt')
  t.deepEqual(res.downloaded, res.blocks)

  // ensure not yet downloaded
  var res = await vault.stat('/subdir/hello.txt')
  t.deepEqual(res.downloaded, 0)

  // download
  await vault.download('/')

  // ensure downloaded
  var res = await vault.stat('/subdir/hello.txt')
  t.deepEqual(res.downloaded, res.blocks)
})

test('vault.createFileActivityStream', async t => {
  // create a fresh dPack
  var vault = await DPackVault.create({title: 'Another Test DPack'})
  await vault._loadPromise

  // start the stream
  var res = []
  var events = vault.createFileActivityStream()
  events.addEventListener('changed', function ({path}) {
    res.push(path)
  })

  // make changes
  await vault.writeFile('/a.txt', 'one', 'utf8')
  await vault.writeFile('/b.txt', 'one', 'utf8')
  await vault.writeFile('/a.txt', 'one', 'utf8')
  await vault.writeFile('/a.txt', 'two', 'utf8')
  await vault.writeFile('/b.txt', 'two', 'utf8')
  await vault.writeFile('/c.txt', 'one', 'utf8')

  var n = 0
  while (res.length !== 6 && ++n < 10) {
    await sleep(500)
  }
  t.deepEqual(res, ['/a.txt', '/b.txt', '/a.txt', '/a.txt', '/b.txt', '/c.txt'])
})

test('vault.createNetworkActivityStream', async t => {
  // distribute the test static dPack
  var testStaticDPack2 = await createDPack()
  var testStaticDPack2URL = 'dweb://' + testStaticDPack2.vault.key.toString('hex')
  var vault = new DPackVault(testStaticDPack2URL)
  await vault._loadPromise

  // start the download & network stream
  var res = {
    metadata: {
      down: 0,
      all: false
    },
    content: {
      down: 0,
      all: false
    }
  }
  var events = vault.createNetworkActivityStream()
  events.addEventListener('network-changed', () => {
    res.gotPeer = true
  })
  events.addEventListener('download', ({feed}) => {
    res[feed].down++
  })
  events.addEventListener('sync', ({feed}) => {
    res[feed].all = true
  })

  // do writes
  await new Promise(resolve => {
    testStaticDPack2.importFiles(__dirname + '/scaffold/dpack-static-test', resolve)
  })

  // download
  await vault.download()

  var n = 0
  while (!res.content.all && ++n < 10) {
    await sleep(500)
  }
  t.truthy(res.metadata.down > 0)
  t.truthy(res.content.down > 0)
  t.deepEqual(res.metadata.all, true)
  t.deepEqual(res.content.all, true)
})

function sleep (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}
