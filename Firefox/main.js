'use strict';
reduxSettingsJSON = JSON.parse(localStorage.getItem("reduxSettings"));
let flags = {
	"likesChanged":false,
	"stylesChanged":false,
	"isRearranged":false,
	"likesTracked":false,
	"recalcListenersAdded":false,
	"trueFullscreenListenersAdded":false
};
let YTReduxURLPath;
let YTReduxURLSearch;
let confirmInterval;
aspectRatio = (window.screen.width / window.screen.height).toFixed(2);
playerSize = {};
playerSize.width = reduxSettingsJSON.smallPlayerWidth == undefined ? 853 : reduxSettingsJSON.smallPlayerWidth;
playerSize.height = Math.ceil(playerSize.width / aspectRatio);
let observerComments;
let observerRelated;
let intervalsArray = [];
let isCheckingRecalc = false;

function confirmIt() {
	let confirmButton = document.querySelector('paper-dialog > yt-confirm-dialog-renderer > div:last-child > div > #confirm-button') || document.querySelector('ytd-popup-container  yt-confirm-dialog-renderer > #main > div.buttons > #confirm-button');
	let buttonStatus = document.querySelector('paper-dialog[aria-hidden="true"]') || document.querySelector('ytd-popup-container > tp-yt-paper-dialog[aria-hidden="true"]');
	let popupElement = document.querySelector('ytd-popup-container  yt-confirm-dialog-renderer > #main > div.buttons > yt-button-renderer');
	let popupTypeCheck = popupElement == null ? false : popupElement.hasAttribute('hidden');
	if (confirmButton != null && !buttonStatus && popupTypeCheck) {
		confirmButton.click();
		document.querySelector('video').play();
		//console.log('Clicked at: ' + new Date());
	}
}

function changeGridWidth() {
	if (location.pathname == "/") {
		let retry = setInterval(function() {
			let styleItem = document.querySelector("#primary > ytd-rich-grid-renderer");
			let currentStyle = styleItem.style.cssText;
			let currentStyleArray = currentStyle.split(";");

			for (let i = 0; i < currentStyleArray.length-1; i++) { //split, replace and join settings on the fly
				if (currentStyleArray[i].includes('--ytd-rich-grid-items-per-row')) {
					let splitElement = currentStyleArray[i].split(":");
					splitElement[1] = reduxSettingsJSON.gridItems + " !important"; //to override different important from css
					currentStyleArray[i] = splitElement.join(":");  
				}
			}
			styleItem.style.cssText = currentStyleArray.join(";");
			if (currentStyle != "" && currentStyle.includes('--ytd-rich-grid-items-per-row:' + reduxSettingsJSON.gridItems)) {clearInterval(retry);}
		},100);
	}
}

function waitForElement(selector, interval, callback) {
	let wait = setInterval(() => {
		let element = document.querySelector(selector);
		if (element != null) {
			clearInterval(wait);
			let index = intervalsArray.indexOf(wait); //get index of and remove the previously added interval from array when it's cleared
			intervalsArray.splice(index, 1);
			callback();
		}
	}, interval);
	intervalsArray.push(wait); //add current interval to array
}

function alignItems() {
	let player = document.querySelector('ytd-watch-flexy .html5-video-container');
	let content = document.querySelector('#columns > #primary > #primary-inner');
	let videoInfoElement = document.querySelector('#columns > #primary > #primary-inner > #info ytd-video-primary-info-renderer');
	let calcPadding = Math.ceil(player.getBoundingClientRect().left - content.getBoundingClientRect().left);
	if (calcPadding == 0 || calcPadding >= 1000 || player == null || content == null || videoInfoElement == null) {
		waitForElement('#columns > #primary > #primary-inner > #info ytd-video-primary-info-renderer', 10, alignItems);
		return;
	} else {
		let reduxAlignElement = document.querySelector('#redux-style-align');
		let calcInner = `
            #columns > #primary > #primary-inner {
                padding: 0 ${(calcPadding / window.innerWidth * 100).toFixed(3)}vw 0 ${(calcPadding / window.innerWidth * 100).toFixed(3)}vw !important;
                /*padding: 0 ${calcPadding}px 0 ${calcPadding}px !important;*/
            }
            #secondary.ytd-watch-flexy {
                transform: translateX(-${calcPadding}px);
            }
            #playlist > #container {
                max-height: calc(${Math.ceil(document.querySelector('video').getBoundingClientRect().height)}px + 1px) !important;
            }
            `;
		if (reduxSettingsJSON.blackBars) {
			calcInner += `
                .html5-video-container video {
                    background-color: black;
                }
                `;
		}
		if (reduxAlignElement == null) {
			let customStyle = document.createElement("style");
			customStyle.id = 'redux-style-align';
			let customStyleInner = calcInner;
			customStyle.appendChild(document.createTextNode(customStyleInner));
			document.head.append(customStyle); 
		} else {
			if (reduxAlignElement != null) {
				reduxAlignElement.textContent = "";
			}
			reduxAlignElement.appendChild(document.createTextNode(calcInner));
		}
	}
}

function changeLikesCounter() {
	let likes = document.querySelector('ytd-video-primary-info-renderer #top-level-buttons > ytd-toggle-button-renderer:first-child > a > yt-formatted-string');
	let dislikes = document.querySelector('ytd-video-primary-info-renderer #top-level-buttons > ytd-toggle-button-renderer:nth-child(2) > a > yt-formatted-string');
	let observerConfig = {
		attributes: true
	};
	let observerLikes = new MutationObserver(fixLikes);
	observerLikes.observe(likes, observerConfig);
	let observerDislikes = new MutationObserver(fixLikes);
	observerDislikes.observe(dislikes, observerConfig);
	fixLikes();
	flags.likesTracked = true;

	function fixLikes() {
		observerLikes.disconnect();
		observerDislikes.disconnect();

		let likes = document.querySelector('ytd-video-primary-info-renderer #top-level-buttons > ytd-toggle-button-renderer:first-child > a > yt-formatted-string');
		let dislikes = document.querySelector('ytd-video-primary-info-renderer #top-level-buttons > ytd-toggle-button-renderer:nth-child(2) > a > yt-formatted-string');
		let rawLikesElement = document.querySelector('#info > #menu-container > ytd-sentiment-bar-renderer > tp-yt-paper-tooltip > #tooltip');
		let rawLikes = rawLikesElement.innerText.split("/")[0];
		let rawDislikesElement = document.querySelector('#info > #menu-container > ytd-sentiment-bar-renderer > tp-yt-paper-tooltip > #tooltip');
		let rawDislikes = rawDislikesElement.innerText.split("/")[1];
		if (rawDislikes == undefined) {
			if (dislikes.children.length > 0) {
				likes.innerText = likes.innerText.replace(String.fromCharCode(160), "").replace(/\d+/, "").trim(); //removes &nbsp and digits if they are inserted to vids with disabled comments
				dislikes.innerText = dislikes.innerText.replace(String.fromCharCode(160), "").replace(/\d+/, "").trim();
			}

			observerLikes.observe(likes, observerConfig);
			observerDislikes.observe(dislikes, observerConfig);
			return;
		} else {
			likes.innerText = rawLikes.trim();
			dislikes.innerText = rawDislikes.trim();

			observerLikes.observe(likes, observerConfig);
			observerDislikes.observe(dislikes, observerConfig);
		}
	}
}

function isTheater() {
	if (document.querySelector('ytd-watch-flexy[theater]') != null) {
		return true;
	}
}

function isFullscreen() {
	if (document.querySelector('ytd-watch-flexy[fullscreen]') != null) {
		return true;
	}
}

function recalculateVideoSize() {

	function addListenersForRecalc() {
		let buttons = [
			document.querySelector('.ytp-size-button')
			//document.querySelector('.ytp-fullscreen-button')
		];

		for (let i = 0; i < buttons.length; i++) {
			buttons[i].addEventListener('click', function() {
				startRecalc();
				setTimeout(alignItems, 40); //TODO slow systems may struggle with this timeout when exiting fullscreen - properly detect mode change
			});
		}
		document.addEventListener("fullscreenchange", function() {
			startRecalc();
			setTimeout(alignItems, 40);
		});
		window.addEventListener('resize', () => {
			let repeatInsert = setInterval(() => { //insert in loop for X seconds to prevent YT from overriding
				let specialWidth = document.querySelector('video').offsetWidth;
				let specialHeight = document.querySelector('video').offsetHeight;
				insertRecalcScript(specialWidth, specialHeight);
			}, 500);
			setTimeout(() => {
				clearInterval(repeatInsert);
			}, 2000);
			alignItems();
		});
		flags.recalcListenersAdded = true;
	}

	function insertRecalcScript(width, height) {
		if (width == undefined) {width = playerSize.width;}
		if (height == undefined) {height = playerSize.height;}
		let existingRecalc = document.querySelector('#redux-recalc');
		if (existingRecalc) {existingRecalc.remove();}
		let script = document.createElement('script');
		script.id = 'redux-recalc';
		let scriptInner = `
            var player = document.querySelector('#movie_player');
            player.setInternalSize(${width},${height});
            `;
		script.appendChild(document.createTextNode(scriptInner));
		document.body.append(script);

		if (!isCheckingRecalc) {
			isCheckingRecalc = true;
			let checkLoop = setInterval(() => {
				checkIfProperlyRecalculated(width, height);
			}, 100);
    
			setTimeout(() => {
				clearInterval(checkLoop);
				isCheckingRecalc = false;
			}, 2000);

		}
        
		function checkIfProperlyRecalculated(width, height) {
			let videoPlayerElement = document.querySelector('ytd-watch-flexy .html5-video-container');
			let bottomBarElement = document.querySelector('.ytp-chrome-bottom');
			if (videoPlayerElement != null && bottomBarElement != null && (bottomBarElement.offsetWidth < videoPlayerElement.offsetWidth*0.9)) {
				insertRecalcScript(width, height);
			}
		}
	}

	function startRecalc() {
		let checkingTimeout;
		let checkingVideo = setInterval(() => { //check in loop for X seconds if player size is correct; reset checking if it's not; applied to fix initial page elements load
			let progressBar = document.querySelector('ytd-watch-flexy .ytp-chrome-bottom');
			let leftEdgeDistancePlayer = document.querySelector('#player-container').getBoundingClientRect().x;
			let leftEdgeDistanceInfo = document.querySelector('#page-manager.ytd-app #primary-inner > #info').getBoundingClientRect().x;
			if (progressBar != null && (leftEdgeDistancePlayer > leftEdgeDistanceInfo+10 || progressBar.offsetWidth+12 >= playerSize.width) && !isTheater() && !isFullscreen()) { //TODO more precise condition
				insertRecalcScript();
				if (checkingTimeout != undefined) {
					clearTimeout(checkingTimeout);
					checkingTimeout = undefined;
				}
			} else {
				if (checkingTimeout == undefined) {
					checkingTimeout = setTimeout(() => {
						clearInterval(checkingVideo);
					}, 5000);
				}
			}
		}, 10);
	}
	if (!flags.recalcListenersAdded) {
		waitForElement('.ytp-size-button', 10, addListenersForRecalc);
	} //to recalculate player size when changing between normal, theater and fullscreen modes
	startRecalc();
}

function startObservingComments() {

	function disableInfiniteComments() {
		let comments = document.querySelectorAll('#contents > ytd-comment-thread-renderer');
		let commentsContinuation = document.querySelector('#comments > #sections > #continuations');
		commentsContElement = commentsContinuation.querySelector('yt-next-continuation');
		if (comments.length >= maxComments && commentsContElement != null) {
			observerComments.disconnect();
			commentsContElement.remove();
			if (document.querySelector('#show-more-comments') == null) {
				addCommentsButton();
			}
		}
	}

	function disableInfiniteRelated() {
		setLayoutDifferences();
		if (related.length >= maxRelated && relatedContinuation != null) {
			observerRelated.disconnect();
			relatedContinuation.remove();
			if (document.querySelector('#show-more-related') == null) {
				addRelatedButton();
			}
		}
	}

	function addCommentsButton() {
		let showMoreComments = document.createElement('div');
		let continueElement = commentsContElement;
		let showMoreText = document.querySelector('.more-button.ytd-video-secondary-info-renderer') == null ? 'SHOW MORE' : document.querySelector('.more-button.ytd-video-secondary-info-renderer').textContent;
		showMoreComments.id = 'show-more-comments';
		showMoreComments.style = 'text-align:center; margin-bottom: 16px; margin-right: 15px;';
		showMoreComments.innerHTML = '<input type="button" style="height:30px; width: 100%; transition-duration: 0.5s; border-top: 1px solid #e2e2e2; border-bottom: none; border-left: none; border-right: none; background:none; font-size:11px; outline: none; color: var(--yt-spec-text-primary); cursor:pointer; text-transform: uppercase;"></input>';
		showMoreComments.querySelector('input').value = showMoreText;
		contentsElement.append(showMoreComments);
		document.querySelector('#show-more-comments').onclick = function() {
			let commentsContinuation = document.querySelector('#comments > #sections > #continuations');
			commentsContinuation.append(continueElement);
			window.scrollBy({top: 50, left: 0, behavior: "smooth"});
			this.remove();
			maxComments += commentsInterval;
			observerComments.observe(contentsElement, observerConfig);
		};
	}

	function addRelatedButton() {
		let showMoreRelated = document.createElement('div');
		let continueElement = relatedContinuation;
		let showMoreText = document.querySelector('.more-button.ytd-video-secondary-info-renderer') == null ? 'SHOW MORE' : document.querySelector('.more-button.ytd-video-secondary-info-renderer').textContent;
		showMoreRelated.id = 'show-more-related';
		showMoreRelated.style = 'text-align:center; margin-top: 4px;';
		showMoreRelated.innerHTML = '<input type="button" style="height:30px; width:100%; transition-duration: 0.5s; border-top: 1px solid #e2e2e2; border-bottom: none; border-left: none; border-right: none; background:none; font-size:11px; outline: none; color: var(--yt-spec-text-primary); cursor:pointer; text-transform: uppercase;"></input>';
		showMoreRelated.querySelector('input').value = showMoreText;
		relatedElement.append(showMoreRelated);
		document.querySelector('#show-more-related').onclick = function() {
			relatedElement.append(continueElement);
			window.scrollBy({top: 50, left: 0, behavior: "smooth"});
			this.remove();
			maxRelated += relatedInterval;
			observerRelated.observe(relatedElement, observerConfig);
		};
	}

	function setLayoutDifferences() {
		if (document.querySelector('#secondary > #secondary-inner > #related > ytd-watch-next-secondary-results-renderer > #items').childElementCount <= 3) { //condition for differences in layout between YT languages
			related = document.querySelectorAll('#secondary > #secondary-inner > #related > ytd-watch-next-secondary-results-renderer > #items > ytd-item-section-renderer > #contents > .ytd-item-section-renderer:not(ytd-continuation-item-renderer)');
			relatedContinuation = document.querySelector('#secondary > #secondary-inner > #related > ytd-watch-next-secondary-results-renderer > #items > ytd-item-section-renderer > #contents > ytd-continuation-item-renderer');
			relatedElement = document.querySelector('#secondary > #secondary-inner > #related > ytd-watch-next-secondary-results-renderer > #items > ytd-item-section-renderer > #contents');
		} else {
			related = document.querySelectorAll('#secondary > #secondary-inner > #related > ytd-watch-next-secondary-results-renderer > #items > .ytd-watch-next-secondary-results-renderer:not(ytd-continuation-item-renderer)');
			relatedContinuation = document.querySelector('#secondary > #secondary-inner > #related > ytd-watch-next-secondary-results-renderer > #items > ytd-continuation-item-renderer');
			relatedElement = document.querySelector('#secondary > #secondary-inner > #related > ytd-watch-next-secondary-results-renderer > #items');
		}
	}

	let maxComments = 20;
	let commentsInterval = 20;
	let maxRelated;
	let relatedInterval = 20;
	let commentsContElement;
	let observerConfig = {
		childList: true
	};
	let contentsElement = document.querySelector('#comments > #sections > #contents.style-scope.ytd-item-section-renderer');
	let relatedElement;
	let related;
	let relatedContinuation;

	if (!!document.querySelector('#show-more-comments')) {document.querySelector('#show-more-comments').remove();}
	if (!!document.querySelector('#show-more-related')) {document.querySelector('#show-more-related').remove();}
	setLayoutDifferences();
	maxRelated = related.length >= 39 ? 20 : related.length; //to reset max on url change;
	if (related.length >= maxRelated && relatedContinuation != null) {
		relatedContinuation.remove();
		addRelatedButton();
	}

	observerComments = new MutationObserver(disableInfiniteComments);
	observerComments.observe(contentsElement, observerConfig);
	observerRelated = new MutationObserver(disableInfiniteRelated);
	observerRelated.observe(relatedElement, observerConfig);

	let sortButtons = document.querySelectorAll('div[slot="dropdown-content"] > #menu > a');
	sortButtons.forEach(element => {
		element.onclick = resetCommentsObserver;
	});

	function resetCommentsObserver() {
		let comments = document.querySelectorAll('#contents > ytd-comment-thread-renderer');
		comments.forEach(element => {
			element.remove();
		});
		if (!!document.querySelector('#show-more-comments')) {document.querySelector('#show-more-comments').remove();}
		maxComments = 20;
		observerComments.observe(contentsElement, observerConfig);
	}
}

function rearrangeInfo() {
	let infoTop = document.querySelector('#top-row.ytd-video-secondary-info-renderer');
	let infoBar = document.querySelector('#info.ytd-video-primary-info-renderer');
	let infoContents = document.querySelector('#info-contents > ytd-video-primary-info-renderer');
	let miscButton = document.querySelector('#menu-container > #menu > ytd-menu-renderer > yt-icon-button') || 
        document.querySelector('#info-contents > ytd-video-primary-info-renderer > yt-icon-button.ytd-menu-renderer');
	let dateElement = document.querySelector('#date > yt-formatted-string');
	let dateOuter = document.querySelector('#info-text > #date');
	let descriptionElement = document.querySelector('#container > ytd-expander.ytd-video-secondary-info-renderer > #content');
	let views = document.querySelector('#info-text > #count');
	let likesContainer = document.querySelector('#info > #menu-container');
	let likesBar = document.querySelector('#info > #menu-container > ytd-sentiment-bar-renderer');
	let subButton = document.querySelector('ytd-video-secondary-info-renderer > #container > #top-row > #subscribe-button');
	let uploadInfo = document.querySelector('#top-row > ytd-video-owner-renderer > #upload-info');
	let channelName = document.querySelector('#top-row > ytd-video-owner-renderer > #upload-info > #channel-name');
	let subCount = document.querySelector('#top-row > ytd-video-owner-renderer > #upload-info > #owner-sub-count');
	let subscribeButton = document.querySelector('#meta #sponsor-button');
	let analyticsButton = document.querySelector('#meta #analytics-button');
	let reduxSubDiv = document.createElement('div');
	let videoTitle = document.querySelector('#info-contents div#container > h1');
	let primaryElement = document.querySelector('#columns > #primary > #primary-inner');
	reduxSubDiv.id = 'reduxSubDiv';
	dateElement.classList.add('redux-moved-date');

	infoBar.prepend(infoTop);
	infoContents.append(miscButton);
	moveTopLevelItems();
	descriptionElement.prepend(dateElement);
	if (dateOuter != null) {dateOuter.remove();}
	likesContainer.prepend(likesBar);
	likesContainer.prepend(views);
	uploadInfo.prepend(reduxSubDiv);
	reduxSubDiv.append(subButton);
	reduxSubDiv.append(subCount);
	reduxSubDiv.prepend(analyticsButton);
	reduxSubDiv.prepend(subscribeButton);
	uploadInfo.prepend(channelName);

	if (reduxSettingsJSON.altVideoLayout) {
		let reduxHeader = document.createElement('div');
		reduxHeader.id = 'redux-video-header';
		primaryElement.prepend(reduxHeader);

		if (!reduxSettingsJSON.extraLayout) {
			reduxHeader.style = 'background-color: transparent; box-shadow: none !important;';
		}

		reduxHeader.append(videoTitle);
		reduxHeader.append(infoTop);
	}

	let style = document.createElement('style');
	style.id = 'redux-style-rearrange';
	let innerStyle = `
        /*VID REARRANGE STYLES*/
        .ytd-video-primary-info-renderer > #top-level-buttons.ytd-menu-renderer ytd-button-renderer {
            display:none;
        }
        #reduxSubDiv {
            display: flex !important;
            margin-top: 5px !important;
        }
        #info.ytd-video-primary-info-renderer > #menu-container {
            transform: translateY(5px) !important;
            margin-right: 15px !important;
        }
        #count.ytd-video-primary-info-renderer {
            width: 100% !important;
            display: flex !important;
            justify-content: flex-end !important;
        }
        #info > #menu-container > ytd-sentiment-bar-renderer {
            display: block !important;
            width:100% !important; 
            padding:0 !important;
        }
        #date > yt-formatted-string, .redux-moved-date {
            font-weight: 500 !important;
            color: var(--yt-spec-text-primary) !important;
        }
        #container > ytd-expander.ytd-video-secondary-info-renderer > #content > #description {
            margin-top: 5px !important;
        }
        #menu.ytd-video-primary-info-renderer {
            display: flex !important;
            justify-content: flex-end !important;
        }
        #primary-inner > #meta > #meta-contents > ytd-video-secondary-info-renderer > #container > ytd-expander {
            margin-left: 0 !important;
        }
        #top-row > ytd-video-owner-renderer > #upload-info > #owner-sub-count, #reduxSubDiv > #owner-sub-count {
            padding-top: 4px !important;
            margin-left: 4px !important;
        }
        #reduxSubDiv > #subscribe-button > ytd-subscribe-button-renderer > paper-button, 
        #reduxSubDiv > #subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button, 
        #reduxSubDiv > #subscribe-button > ytd-button-renderer > a > paper-button,
        #reduxSubDiv > #subscribe-button > ytd-button-renderer > a > tp-yt-paper-button,
        #sponsor-button > ytd-button-renderer > a > paper-button, 
        #sponsor-button > ytd-button-renderer > a > tp-yt-paper-button, 
        #analytics-button > ytd-button-renderer > a > paper-button,
        #analytics-button > ytd-button-renderer > a > tp-yt-paper-button {
            margin: 0 !important; 
            padding: 2px 8px 2px 8px !important; 
            text-transform: none !important; 
            font-weight: normal !important; 
            font-size: 12px !important;
            max-height: 24px !important;
            height: 24px !important;
        }
        #reduxSubDiv > #subscribe-button > ytd-subscribe-button-renderer > paper-button > yt-formatted-string, 
        #reduxSubDiv > #subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button > yt-formatted-string,
        #reduxSubDiv > #subscribe-button > ytd-button-renderer > a > paper-button > yt-formatted-string,
        #reduxSubDiv > #subscribe-button > ytd-button-renderer > a > tp-yt-paper-button > yt-formatted-string {
            padding-top: 1px !important;
        }
        #reduxSubDiv > #subscribe-button > ytd-subscribe-button-renderer > paper-button:not([subscribed])::before,
        #reduxSubDiv > #subscribe-button > ytd-subscribe-button-renderer > tp-yt-paper-button:not([subscribed])::before, 
        #reduxSubDiv > #subscribe-button > ytd-button-renderer > a > paper-button:not([subscribed])::before,
        #reduxSubDiv > #subscribe-button > ytd-button-renderer > a > tp-yt-paper-button:not([subscribed])::before {
            content: url('${browser.extension.getURL('/images/sub-icon.png')}') !important;
            background-size: auto !important;
            width: 16px !important;
            height: 12px !important;
            margin-right: 6px !important;
        }
        #sponsor-button.ytd-video-owner-renderer, #analytics-button.ytd-video-owner-renderer {
            margin-right: 0px !important;
        }
        #sponsor-button.ytd-video-owner-renderer > ytd-button-renderer, #analytics-button.ytd-video-owner-renderer > ytd-button-renderer {
            margin-right: 4px !important;
        }
        #notification-preference-button > ytd-subscription-notification-toggle-button-renderer > a > yt-icon-button {
            max-height: 21px !important; 
            max-width: 21px !important; 
            padding: 0 !important; 
            margin-right: 5px !important;
        }
        #meta-contents > ytd-video-secondary-info-renderer > #container > ytd-expander > #content {
            margin-top: 5px !important;
        }
        ytd-expander[collapsed] > #content.ytd-expander {
            max-height: max(var(--ytd-expander-collapsed-height), 65px) !important;
        }
        #top-level-buttons > ytd-toggle-button-renderer > a > yt-icon-button > #button > yt-icon {
            height: 20px !important;
            width: 20px !important;
        }
        `;
	style.appendChild(document.createTextNode(innerStyle));
	document.querySelector('head').append(style);
	flags.isRearranged = true;
}

function moveTopLevelItems() {
	let topLevelElements = document.querySelectorAll('.ytd-video-primary-info-renderer > #top-level-buttons.ytd-menu-renderer ytd-button-renderer');
	let infoContents = document.querySelector('#info-contents > ytd-video-primary-info-renderer');
	let infoDiv = document.querySelector('#info-contents div#info');
	let miscButton = document.querySelector('#info-contents ytd-video-primary-info-renderer > yt-icon-button');
	let existingMovedItem = document.querySelector('#menu-container > #menu > ytd-menu-renderer > yt-icon-button') || 
        document.querySelector('#info-contents > ytd-video-primary-info-renderer > yt-icon-button.ytd-menu-renderer');
        
	if (reduxSettingsJSON.altVideoLayout) {
		document.querySelector('ytd-video-primary-info-renderer').style = 'padding-left: 15px !important; padding-top: 15px !important';
		if (miscButton != null) {
			infoDiv.prepend(miscButton);
			miscButton.style = 'transform: translateY(0px)';
		}

		for (let i = 0; i < topLevelElements.length; i++) {
			infoDiv.prepend(topLevelElements[i]);
			topLevelElements[i].classList.add('redux-moved-info');
			topLevelElements[i].style.display = 'inline-block';
		}
            
		if (reduxSettingsJSON.altVideoLayoutExtra) {
			let remainingTopLevel = document.querySelector('#info #top-level-buttons');
			let likesValues = [
				document.querySelectorAll('ytd-toggle-button-renderer #text.ytd-toggle-button-renderer')[0].getAttribute('aria-label'),
				document.querySelectorAll('ytd-toggle-button-renderer #text.ytd-toggle-button-renderer')[1].getAttribute('aria-label')
			];
			let separator = ", ";
			if (likesValues[0] == null) {
				likesValues[0] = "";
				separator = "";
			}
			if (likesValues[1] == null) {
				likesValues[1] = "";
				separator = "";
			}
			let menu = document.querySelector('#menu.ytd-video-primary-info-renderer');
			let likesText = document.createTextNode(`${likesValues[0]}${separator}${likesValues[1]}`);

			document.querySelector('#info.ytd-video-primary-info-renderer > #menu-container').style = 'transform: translateY(0px) !important;';
			for (let i = 0; i < menu.childNodes.length; i++) { //remove existing text nodes
				if (menu.childNodes[i].nodeType == 3) {
					menu.childNodes[i].remove();
				}
			}

			menu.prepend(likesText);
			infoDiv.prepend(remainingTopLevel);
		}
            
	} else {
		for (let i = topLevelElements.length-1; i >= 0; i--) {
			infoContents.insertBefore(topLevelElements[i], existingMovedItem);
			topLevelElements[i].classList.add('redux-moved-info');
			topLevelElements[i].style.display = 'inline-block';
		}
	}
}

function clearMovedInfo() {
	let moveInfo = document.querySelectorAll('.redux-moved-info');
	moveInfo.forEach(element => element.remove());
	waitForElement('.ytd-video-primary-info-renderer > #top-level-buttons.ytd-menu-renderer ytd-button-renderer', 10, moveTopLevelItems);
}

function clearStoredIntervals() {
	intervalsArray.forEach(element => {
		clearInterval(element);
		intervalsArray.shift();
	});
}

function splitTrending() {
	let elems = document.querySelectorAll('#contents > ytd-expanded-shelf-contents-renderer > #grid-container > ytd-video-renderer');
	if (elems.length == 0) { //repeat because it can be emptied when navigating through different pages
		setTimeout(() =>{splitTrending();}, 1000);
		return;
	}
	for (let i = 0; i < elems.length; i++) {
		if (i % 2 != 0) {elems[i].style.float = 'left';}
		elems[i].style.width = '50%';
		let description = elems[i].querySelector('yt-formatted-string#description-text');
		description.style.fontSize = '1.2rem';
		description.style.paddingTop = '4px';
		description.style.maxHeight = 'calc(2 * var(--yt-thumbnail-attribution-line-height, 3.5rem))';
	}
}

function splitTrendingLoop() {
	let splitLoop = setInterval(splitTrending, 100);
	setTimeout(() => {clearInterval(splitLoop);}, 5000);
}

function preventScrolling() {

	function scrollingAction(e) {
		e.preventDefault();
	}

	function keysAction(e) {
		if (e.keyCode == 33 || e.keyCode == 34) {
			e.preventDefault();
		}
	}

	document.addEventListener('fullscreenchange', function() {
		setTimeout(() => { //timeout accomodates for fullscreen transition animation
			if (document.querySelector('ytd-watch-flexy[fullscreen]') != null) {
				document.querySelector('.ytp-right-controls > button.ytp-fullerscreen-edu-button.ytp-button').style.display = 'none';
				document.addEventListener('wheel', scrollingAction, {passive: false});
				document.addEventListener('keydown', keysAction, {passive: false});
			} else {
				document.removeEventListener('wheel', scrollingAction, {passive: false});
				document.removeEventListener('keydown', keysAction, {passive: false});
			}
		}, 25);
	});

	flags.trueFullscreenListenersAdded = true;
}

function sortPlaylists() {
	if (!!document.querySelector('.redux-playlist')) return;
	let baseTimeout = 250;
	setTimeout(() => {
		let playlistItems = document.querySelectorAll('[page-subtype="home"] #contents.ytd-rich-grid-renderer:not(.redux-playlist) > ytd-rich-item-renderer ytd-thumbnail-overlay-bottom-panel-renderer');
		let itemsContainer = document.querySelector('[page-subtype="home"] #contents.ytd-rich-grid-renderer:not(.redux-playlist)');
		let allContainer = document.querySelector('ytd-rich-grid-renderer');
		let currentLength = playlistItems.length;
		if (currentLength == 0) return;
    
		let playlistReduxDiv = document.createElement('div');
		playlistReduxDiv.style = 'transition-duration: 0.5s; opacity:0';
		playlistReduxDiv.id = "contents";
		playlistReduxDiv.className += 'redux-playlist style-scope ytd-rich-grid-renderer';
		allContainer.insertBefore(playlistReduxDiv, itemsContainer);
		setTimeout(() => {playlistReduxDiv.style.opacity = '1';}, baseTimeout);
    
		for (let i = 0; i < playlistItems.length; i++) {
			let parentEl = playlistItems[i].closest('ytd-rich-item-renderer');
			parentEl.style = 'transition-duration:0.25s; opacity: 1;';
			setTimeout(() => {parentEl.style.opacity = '0';}, 0);
			setTimeout(() => {
				playlistReduxDiv.prepend(parentEl);
				parentEl.style.opacity = '1';
			}, baseTimeout);
		}

		function hidePlaylists() {
			let playlistItems = document.querySelectorAll('[page-subtype="home"] #contents.ytd-rich-grid-renderer:not(.redux-playlist) > ytd-rich-item-renderer ytd-thumbnail-overlay-bottom-panel-renderer');
			let movedItems = document.querySelector('.redux-playlist').children;

			if (playlistItems.length > movedItems.length) {
				for (let i = movedItems.length; i < playlistItems.length; i++) {
					playlistReduxDiv.append(playlistItems[i].closest('ytd-rich-item-renderer'));
				}
			} else {
				playlistItems.forEach(element => {
					element.closest('ytd-rich-item-renderer').style.display = "none";
				});
			}
		}
            
		if (reduxSettingsJSON.sortFoundPlaylists) {
			setTimeout(() => {
				let observerConfig = {
					childList: true
				};
				let observerLikes = new MutationObserver(hidePlaylists);
				observerLikes.observe(itemsContainer, observerConfig);
			}, baseTimeout*2);
		}
    
	}, baseTimeout);
}

function main() {
	if (reduxSettingsJSON.autoConfirm) {
		if (confirmInterval == undefined) {
			confirmInterval = setInterval(confirmIt, 500);
		}
	}
	if (!reduxSettingsJSON.rearrangeInfo && window.location.href.includes('/watch?') && !flags.isRearranged) {
		waitForElement('.ytd-video-primary-info-renderer > #top-level-buttons.ytd-menu-renderer ytd-button-renderer', 10, rearrangeInfo);
	}
	if (reduxSettingsJSON.smallPlayer && window.location.href.includes('/watch?')) {
		waitForElement('ytd-watch-flexy #movie_player', 10, recalculateVideoSize);
		waitForElement('#redux-recalc', 10, alignItems);
	}
	if (reduxSettingsJSON.disableInfiniteScrolling && window.location.href.includes('/watch?')) {
		waitForElement('#contents > ytd-comment-thread-renderer, #contents > ytd-message-renderer', 10, startObservingComments); // additional element in selector for videos with disabled comments
	}
	if (reduxSettingsJSON.showRawValues && window.location.href.includes('/watch?') && !flags.likesTracked) {
		waitForElement('#top-level-buttons > ytd-toggle-button-renderer:first-child > a > yt-formatted-string[aria-label]:not([aria-label=""])', 10, changeLikesCounter);
	}
	if (window.location.href.includes('/feed/trending') || window.location.href.includes('/feed/explore')) {
		waitForElement('#page-manager ytd-browse #primary > ytd-section-list-renderer > #continuations', 10, splitTrendingLoop);
	}
	if (reduxSettingsJSON.trueFullscreen && window.location.href.includes('/watch?') && !flags.trueFullscreenListenersAdded) {
		preventScrolling();
	}
	if (reduxSettingsJSON.playlistsFirst && window.location.pathname === '/') {
		waitForElement('#page-manager ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer ytd-thumbnail-overlay-bottom-panel-renderer', 10, sortPlaylists);
	}
	changeGridWidth();
}

function start() {
	main();
	YTReduxURLPath = location.pathname;
	YTReduxURLSearch = location.search;
	setInterval(function() {
		if (location.pathname != YTReduxURLPath || location.search != YTReduxURLSearch) {
			YTReduxURLPath = location.pathname;
			YTReduxURLSearch = location.search;
			flags.likesChanged = false;
			if (reduxSettingsJSON.disableInfiniteScrolling) {
				if (observerComments != undefined) {
					observerComments.disconnect();
				}
				if (observerRelated != undefined) {
					observerRelated.disconnect();
				}
				let comments = document.querySelectorAll('#contents > ytd-comment-thread-renderer');
				comments.forEach(element => { //remove comments because YT sometimes keeps old ones after url change which messes with comments observer checking their length; also applied when sorting
					element.remove();
				});
			}
			clearStoredIntervals();
			if (!!document.querySelector('.redux-moved-info') && window.location.href.includes('/watch?')) {
				clearMovedInfo(); //contains an interval
			}
			main();
		}
	},100);
}

start();