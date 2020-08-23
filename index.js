exports.handler = (event, context, cb1) => {
	//console.log(event);
	const wraplimit = 80;
	const leading = 40;

	let px = 60; // starting X coord
	let py = 200;

	const jimp = require('jimp');

	const font = require('./font.json');

	const async = require('async');

	const AWS = require('aws-sdk');

	const fs = require('fs');

	const querystring = require("querystring");

	const f = font.font; // read font coords from external json file

	const default_text = 'You fight like a dairy farmer.';

	let inputstring;

	// if nothing is passed, make it the default string.
	if (!event.pathParameters) {
		inputstring = default_text;
	}
	// otherwise, add the initial string which may or may not include an image.png trailing uri
	else {
		inputstring = querystring.unescape(event.pathParameters.proxy);
		inputstring = inputstring.slice(0, 140);
	}

	// match only text that comes before the first forward slash
	inputstring = inputstring.match(/([^\/\n]+)/)[1];

	// if only an image.png-like uri is passed, strip it off and make the input string the default
	if (inputstring.match(/^([^\/\n]+\.png)$/)) {
		inputstring = default_text;
	}

	// pad with string - used later in word wrapping algo
	inputstring = inputstring + ' ';

	var heightoffset = Math.floor(inputstring.length / 40);

	py -= (heightoffset * leading);

	var is = inputstring.split('');

	is = is.filter(function(i) { return Object.keys(f).indexOf(i) != -1; }); // filter out characters not in the bitmap font

	// waterfall
	async.waterfall([
			read_font,
			read_image,
			overlay
		],
		(err, res) => {
			let resobj = {
				statusCode: 200,
				headers: {
					'Content-Type': 'image/png'
				},
				isBase64Encoded: true,
				body: res
			};

			if (err) {
				resobj.statusCode = 400;
				resobj.body = 'xxx';
			}
			cb1(null, resobj);
		}
	);



	function read_font(callback) {
		jimp.read('./fonts/font_white.png', function(err, font) {
			callback(err, font);
		});
	} // read_font


	//
	// read_image
	//
	function read_image(font, callback) {
		const rand = Math.floor((Math.random() * 4) + 1);

		const randimg = 'misf_scene' + rand + '.png';

		jimp.read('./images/' + randimg, function(err, image) {
			callback(err, font, image);
		});

	} // read_image


	//
	// overlay
	//

	function overlay(font, image, callback) {
		let tx = 0;
		let ty = 0;

		let o = image.clone(); // make a copy of the original input background image

		for (var l = 0; l < is.length; l++) {

			var letter = font.clone(); // make a copy of the image to crop down to each individual letter
			// get the coords of the current letter
			var x = Number(f[is[l]].x);
			var y = Number(f[is[l]].y);
			var w = Number(f[is[l]].w);
			var h = Number(f[is[l]].h);

			letter.crop(x, y, w, h);

			var yoffset = (['p', 'q', 'j', 'y', 'g', ',', '¡', '¿'].indexOf(is[l]) != -1) ? 4 : 0; // for these chars, shift the letter down 4 pixels

			if (l > 0) {
				tx += Number(f[is[l - 1]].w); // incremement new print position by width of previous character
				if (is[l - 1] == ' ') { // when at a char after a space, decide on whether to wrap the line
					var nextspace = is.slice(l, is.length).indexOf(' ');
					var curword = is.slice(l, l + nextspace);
					let curwordwidtharray = curword.map((z) => { return Number(f[z].w); }); // add the widths of all the chars in the current word
					let curwordwidth = (curwordwidtharray.length > 0) ? curwordwidtharray.reduce((total, val) => { return total + val; }) : 0;
					if ((px + tx + curwordwidth) > (image.bitmap.width - wraplimit)) { // add in a newline - return x to start, add leading to y
						ty += leading;
						tx = 0;
					}
				}
			}

			o.composite(letter, px + tx, py + ty + yoffset);

		} // for

		o.getBuffer('image/png', (err, imgbuf) => {
			let b64 = Buffer.from(imgbuf).toString('base64');
			//console.log ('length: ', b64.length);
			//console.log ('err: ', err);
			callback(err, b64);
		});

	} // overlay

}
