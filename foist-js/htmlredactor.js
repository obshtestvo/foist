/* jshint strict: true, es3: true */
/* global $: false, console: false */

(function(exports){
'use strict';

var getReplacement = function(len, repl){
  repl = repl === undefined ? '!' : repl;
  var s = [];
  for (var i = 0; i < len; i += 1) {
    s.push(repl);
  }
  return s.join('');
};
var getOffset = function(e){
  return [
    (e.offsetX || e.originalEvent.layerX),
    (e.offsetY || e.originalEvent.layerY)
  ];
};

function HTMLRedactor(options){
  this.containerId = options.container;
  this.url = options.htmlUrl;

  this.container = $('#' + this.containerId);

  this.prevButton = $('.htmlredactor-prev', this.container);
  this.nextButton = $('.htmlredactor-next', this.container);

  this.totalPagesDisplay = $('.htmlredactor-total', this.container);
  this.currentPageDisplay = $('.htmlredactor-current', this.container);

  this.iframeContainer = $('.htmlredactor-iframe-container', this.container);
}

HTMLRedactor.prototype.init = function() {
  var self = this;

  var deferred = $.Deferred();

  this.iframe = $('<iframe name="iframe" class="htmlredactor-iframe" src="' + self.url + '"></iframe');
  self.iframe.css('width', this.container.css('width'));
  this.iframeContainer.append(this.iframe);

  this.iframe.on('load', function(){

    self.iframeWindow = self.iframe[0].contentWindow;
    self.contents = self.iframe.contents();
    self.pages = $('.pf', self.contents);
    self.iframe.height($(self.pages[0]).height() + 26);

    // Using promise to fetch the page
    self.currentPage = 1;
    self.numPages = self.pages.length;
    // self.renderPage(self.currentPage);

    self.totalPagesDisplay.text(self.numPages);
    self.currentPageDisplay.text(self.currentPage);

    self.prevButton.on('click', function(){
      self.currentPage -= 1;
      if (self.currentPage < 1) {
        self.currentPage = 1;
      }
      self.updateButtons();
      self.renderPage(self.currentPage);
      self.currentPageDisplay.text(self.currentPage);
    });

    self.nextButton.on('click', function(){
      self.currentPage += 1;
      if (self.currentPage > self.numPages) {
        self.currentPage = self.numPages;
      }
      self.updateButtons();
      self.renderPage(self.currentPage);
      self.currentPageDisplay.text(self.currentPage);
    });

    self.updateButtons();
    self.setupEventListeners();

    deferred.resolve();

  });

  return deferred;
};

HTMLRedactor.prototype.setupEventListeners = function(){
  var self = this;
  self.mouseDownImage = null;
  self.mouseDownCoordinates = null;
  var contents = this.contents;

  $('.pc img', contents).mousedown(function(e){
    console.log('image mousedown');
    e.preventDefault();
    console.log(e);
    console.log($(this).offset());
    self.mouseDownImage = $(this);
    self.mouseDownCoordinates = getOffset(e);
  });

  $('.pc img', contents).mouseup(function(e){
    console.log('image mouseup');
    e.preventDefault();
    e.stopPropagation();
    self.handleImageRedaction(e, $(this));
  });

  $('.pc', contents).mouseup(function(e){
    self.handleImageRedaction(e);
  });

  $('.pc a', contents).click(function(e){
    console.log('link mouseup');
    e.preventDefault();
    $(this).remove();
  });
  $('.pc .t', contents).mouseup(function(e){
    console.log('text mouseup');
    e.preventDefault();
    if (self.handleImageRedaction(e)) {
      return;
    }
    var selection = self.iframeWindow.getSelection();
    var span = document.createElement('span');
    if (selection.rangeCount === 0) {
      return;
    }
    var range = selection.getRangeAt(0);
    var selectionClone = range.cloneContents()
    if (selectionClone.children.length > 1) {
      alert('We cannot do multiple lines yet. Please try line by line.')
      return;
    }
    span.appendChild(range.extractContents());
    range.insertNode(span);

    var width = $(span).width();
    var height = $(span).height();
    $(span).css({
      width: width + 'px',
      height: (height * 0.75) + 'px',
      'background-color': '#000',
      display: 'inline-block',
      overflow: 'hidden'
    }).text('');
  });
};

HTMLRedactor.prototype.handleImageRedaction = function(e, image) {
  if (this.mouseDownImage === null || (image && this.mouseDownImage[0] !== image[0])) {
    this.mouseDownImage = null;
    this.mouseDownCoordinates = null;
    return false;
  }
  console.log('image redaction', this.mouseDownImage, this.mouseDownCoordinates);

  var canvas = document.createElement('canvas');
  var img = document.createElement('img');
  img.src = this.mouseDownImage[0].src;
  var xratio = img.width / this.mouseDownImage[0].width;
  var yratio = img.height / this.mouseDownImage[0].height;
  canvas.width = img.width;
  canvas.height = img.height;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  var newOffset;
  if (image) {
    newOffset = getOffset(e);
  } else {
    /* TODO: fix this, it's broken */
    /* mouse went out of image, find out which corner */
    newOffset = getOffset(e);
    var targetOffset = $(e.target).offset();
    var imageOffset = this.mouseDownImage.offset();
    var imageX = imageOffset.left - targetOffset.left;
    var imageY = imageOffset.top - targetOffset.top;

    if (newOffset[0] < imageX) {
      newOffset[0] = 0;
    } else if (newOffset[0] > imageX + this.mouseDownImage[0].width) {
      newOffset[0] = this.mouseDownImage[0].width;
    }
    if (newOffset[1] < imageY) {
      newOffset[1] = 0;
    } else if (newOffset[1] > imageY + this.mouseDownImage[0].height) {
      newOffset[1] = this.mouseDownImage[0].height;
    }
  }
  ctx.fillStyle = '#000';
  var x, y, w, h;
  if (this.mouseDownCoordinates[0] < newOffset[0]) {
    x = this.mouseDownCoordinates[0];
    w = newOffset[0] - x;
  } else {
    x = newOffset[0];
    w = this.mouseDownCoordinates[0] - x;
  }
  if (this.mouseDownCoordinates[1] < newOffset[1]) {
    y = this.mouseDownCoordinates[1];
    h = newOffset[1] - y;
  } else {
    y = newOffset[1];
    h = this.mouseDownCoordinates[1] - y;
  }
  ctx.fillRect(x * xratio, y * yratio, w * xratio, h * yratio);
  this.mouseDownImage.attr('src', canvas.toDataURL('image/png'));

  this.mouseDownImage = null;
  this.mouseDownCoordinates = null;
  return true;
};

HTMLRedactor.prototype.updateButtons = function(){
  var self = this;
  if (self.currentPage == 1) {
    self.prevButton.prop('disabled', true);
  } else {
    self.prevButton.prop('disabled', false);
  }
  if (self.currentPage == self.numPages) {
    self.nextButton.prop('disabled', true);
  } else {
    self.nextButton.prop('disabled', false);
  }
};

HTMLRedactor.prototype.renderPage = function(pageno) {
  if (pageno === undefined) {
    pageno = this.currentPage;
  }

  var iframeWindowOffset = this.iframe.height();
  var pageOffset = $(this.pages[pageno - 1]).offset().top;
  var dest = 0;
  if (pageOffset > iframeWindowOffset) {
    dest = iframeWindowOffset;
  } else {
    dest = pageOffset;
  }

  $('#page-container', this.contents).animate({scrollTop: dest}, 500, 'swing');
};

HTMLRedactor.prototype.getContent = function(){
  return this.contents.find('html').html();
};

exports.HTMLRedactor = HTMLRedactor;

}(window));