var resultsList = $('.results-list');
var searchInterface = $('.new-query-ui');
var resultsInterface = $('.results-ui');
var newSearch = $('.start-new-query');
var cancelInterface = $('.cancel-interface');
var goingButton = $('.going-button');
var cancelButton = $('.cancel-going');
var username;

// ask server if the user has a search query
// if user already has a query and the returned results are good, render results
// if not, render search interface
$('document').ready(function() {

	// render search interface
	function renderSearchInterface() {
		searchInterface.css({ 'display': 'flex'});
		searchInterface.hide();
		searchInterface.show(500);
	}


	$.ajax({
		url: '/api/query'
	}).done(function(data) {
		if(data === 'no') {
			// no existing search query, render search interface
			renderSearchInterface()
		} else {
			var data = JSON.parse(data);

			if(data.docs.length < 5) {
				// if there isn't much, or any data, render search interface
				renderSearchInterface()

			} else {
				// if there are enough results, render bar results

				// check if the user is authenticated and set username if they are
				if(data.hasOwnProperty('userInfo') && data.userInfo['screen_name']) {
					username = data.userInfo.screen_name;
				}

				$.each(data.docs, buildBarList);
			}
		}
	}).fail(function(err) {
		// request failed, degrade to search interface
		renderSearchInterface()
	});
});


function buildBarList(i, bar) {

	var imgSrc = bar.image_url ? bar.image_url : 'https://c1.staticflickr.com/1/145/409539761_c529e76318.jpg';
	var cancelDisplay = 'hide';
	var goingDisplay = 'hide';

	if(username) {
		if(bar.guests.indexOf(username) !== -1) { // check if user is in guests array
			// if user is authenticated and going to this bar, show cancel interface
			cancelDisplay = 'show';
		} else {
			// if user is authenticated and not going to this bar, show going button
			goingDisplay = 'show';
		}
	}

	resultsList.append(
			`<div class="bar">
				<img src=" ${imgSrc} " alt="https://c1.staticflickr.com/1/145/409539761_c529e76318.jpg" class="bar-picture">
				<div class="bar-interface">
					<div class="going-ticker">${bar.guests.length} Going</div>
					<a href="/api/add-guest/${bar.id}" class="going-button ${goingDisplay}">Join Us!</a>
					<div class="cancel-interface ${cancelDisplay}">
						<a href="/api/remove-guest/${bar.id}" class="cancel-going">Can't Make it</a>
					</div>
				</div>
				<div class="bar-info">
					<div class="bar-title">${bar.name}</div>
					<div class="bar-description">${bar.snippet_text}</div>
				</div>
			</div>`
		);



	searchInterface.hide(500);

	resultsInterface.css({'display': 'flex'});
	resultsInterface.hide();
	resultsInterface.show(500);

	resultsList.css({'display': 'flex'});
	resultsList.hide();
	resultsList.show(500);

}


$('.submit-location').click(function() {
	var userLocation = $('.user-location-input').val();
	$('.user-location-input').val('');

	if(userLocation) {
		// only send request if the user actually input something

		$.ajax({
			// send request for bar data in this area
			url: '/api/search/' + userLocation
		}).done(function(data) {
			var data = JSON.parse(data);
			// use data to build DOM

			// check if the user is authenticated and set username if they are
			if(data.hasOwnProperty('userInfo') && data.userInfo['screen_name']) {
				username = data.userInfo.screen_name;
			}

			$.each(data.docs, buildBarList);
		});
	}
	
});

// change interface from displaying results to search interface
$(newSearch).click(function() {
	resultsList.hide(500);
	resultsInterface.hide(500);
	resultsList.empty();

	searchInterface.css({'display': 'flex'});
	searchInterface.hide();	
	searchInterface.show(500);
});


// when user clicks a join button
$('.results-list').on('click', 'a.going-button', function(e) {

	// prevent default request from being sent
	e.preventDefault();
	var ele = $(this);
	var link = ele[0].href;

	$.ajax({
		url: ele[0].href
	}).done(function(doc) {

		// update number of people going
		ele.siblings('.going-ticker').text(doc.guests.length + ' Going');

		// toggle interface
		ele.toggle(500);
		ele.siblings('.cancel-interface').toggle(500);

	})

	return false;

})

// when user clicks a cancel button
$('.results-list').on('click', 'a.cancel-going', function(e) {

	// prevent default request from being sent
	e.preventDefault();
	var ele = $(this);
	var link = ele[0].href;

	$.ajax({
		url: ele[0].href
	}).done(function(doc) {
		console.log(doc.guests.length);

		// update number of people going

		ele.parent().siblings('.going-ticker').text(doc.guests.length + ' Going');

		// toggle interface
		ele.parent().toggle(500);
		ele.parent().siblings('.going-button').toggle(500);
	})

	return false;

})