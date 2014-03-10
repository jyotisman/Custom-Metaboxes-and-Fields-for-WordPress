/**
 * Controls the behaviours of custom metabox fields.
 *
 * @author Andrew Norcross
 * @author Jared Atchison
 * @author Bill Erickson
 * @author Justin Sternberg
 * @see    https://github.com/webdevstudios/Custom-Metaboxes-and-Fields-for-WordPress
 */

/*jslint browser: true, devel: true, indent: 4, maxerr: 50, sub: true */
/*global jQuery, tb_show, tb_remove */

/**
 * Custom jQuery for Custom Metaboxes and Fields
 */
window.CMB = (function(window, document, $, undefined){
	'use strict';

	// localization strings
	var l10n = window.cmb_l10;

	// CMB functionality object
	var cmb = {
		formfield : '',
		idNumber  : false,
		file_frames: {},
	}

	cmb.metabox = function() {
		if ( cmb.$metabox ) {
			return cmb.$metabox;
		}
		cmb.$metabox = $('table.cmb_metabox');
		return cmb.$metabox;
	}

	cmb.init = function() {
		cmb.log( l10n );

		var $metabox = cmb.metabox();

		// hide our spinner gif if we're on a MP6 dashboard
		if ( l10n.new_admin_style ) {
			$metabox.find('.cmb-spinner img').hide();
		}

		/**
		 * Initialize time/date/color pickers
		 */
		cmb.initPickers( $metabox.find('input:text.cmb_timepicker'), $metabox.find('input:text.cmb_datepicker'), $metabox.find('input:text.cmb_colorpicker') );

		// Wrap date picker in class to narrow the scope of jQuery UI CSS and prevent conflicts
		$("#ui-datepicker-div").wrap('<div class="cmb_element" />');


		$('.cmb_metabox')
			.on( 'change', '.cmb_upload_file', function() {
				cmb.formfield = $(this).attr('id');
				$('#' + cmb.formfield + '_id').val('');
			})
			// Media/file management
			.on( 'click', '.cmb_upload_button', cmb.handleMedia )
			.on( 'click', '.cmb_remove_file_button', cmb.handleRemoveMedia )
			// Repeatable content
			.on( 'click', '.add-row-button', cmb.addAjaxRow )
			.on( 'click', '.remove-row-button', cmb.removeAjaxRow )
			// Ajax oEmbed display
			.on( 'keyup paste focusout', '.cmb_oembed', cmb.maybeOembed );

		// on pageload
		setTimeout( cmb.resizeoEmbeds, 500);
		// and on window resize
		$(window).on( 'resize', cmb.resizeoEmbeds );

	}

	cmb.handleMedia = function(event) {

		event.preventDefault();

		var $metabox     = cmb.metabox();
		var $self        = $(this);
		cmb.formfield    = $self.prev('input').attr('id');
		var $formfield   = $('#'+cmb.formfield);
		var formName     = $formfield.attr('name');
		var uploadStatus = true;
		var attachment   = true;
		var isList       = $self.hasClass( 'cmb_upload_list' );

		// If this field's media frame already exists, reopen it.
		if ( cmb.formfield in cmb.file_frames ) {
			cmb.file_frames[cmb.formfield].open();
			return;
		}

		// Create the media frame.
		cmb.file_frames[cmb.formfield] = wp.media.frames.file_frame = wp.media({
			title: $metabox.find('label[for=' + cmb.formfield + ']').text(),
			button: {
				text: l10n.upload_file
			},
			multiple: isList ? true : false
		});

		var handlers = {
			list : function( selection ) {
				// Get all of our selected files
				attachment = selection.toJSON();

				$formfield.val(attachment.url);
				$('#'+ cmb.formfield +'_id').val(attachment.id);

				// Setup our fileGroup array
				var fileGroup = [];

				// Loop through each attachment
				$( attachment ).each( function() {
					if ( this.type && this.type === 'image' ) {
						// image preview
						uploadStatus = '<li class="img_status">'+
							'<img width="50" height="50" src="' + this.url + '" class="attachment-50x50" alt="'+ this.filename +'">'+
							'<p><a href="#" class="cmb_remove_file_button" rel="'+ cmb.formfield +'['+ this.id +']">'+ l10n.remove_image +'</a></p>'+
							'<input type="hidden" id="filelist-'+ this.id +'" name="'+ formName +'['+ this.id +']" value="' + this.url + '">'+
						'</li>';

					} else {
						// Standard generic output if it's not an image.
						uploadStatus = '<li>'+ l10n.file +' <strong>'+ this.filename +'</strong>&nbsp;&nbsp;&nbsp; (<a href="' + this.url + '" target="_blank" rel="external">'+ l10n.download +'</a> / <a href="#" class="cmb_remove_file_button" rel="'+ cmb.formfield +'['+ this.id +']">'+ l10n.remove_file +'</a>)'+
							'<input type="hidden" id="filelist-'+ this.id +'" name="'+ formName +'['+ this.id +']" value="' + this.url + '">'+
						'</li>';

					}

					// Add our file to our fileGroup array
					fileGroup.push( uploadStatus );
				});

				// Append each item from our fileGroup array to .cmb_media_status
				$( fileGroup ).each( function() {
					$formfield.siblings('.cmb_media_status').slideDown().append(this);
				});
			},
			single : function( selection ) {
				// Only get one file from the uploader
				attachment = selection.first().toJSON();

				$formfield.val(attachment.url);
				$('#'+ cmb.formfield +'_id').val(attachment.id);

				if ( attachment.type && attachment.type === 'image' ) {
					// image preview
					uploadStatus = '<div class="img_status"><img style="max-width: 350px; width: 100%; height: auto;" src="' + attachment.url + '" alt="'+ attachment.filename +'" title="'+ attachment.filename +'" /><p><a href="#" class="cmb_remove_file_button" rel="' + cmb.formfield + '">'+ l10n.remove_image +'</a></p></div>';
				} else {
					// Standard generic output if it's not an image.
					uploadStatus = l10n.file +' <strong>'+ attachment.filename +'</strong>&nbsp;&nbsp;&nbsp; (<a href="'+ attachment.url +'" target="_blank" rel="external">'+ l10n.download +'</a> / <a href="#" class="cmb_remove_file_button" rel="'+ cmb.formfield +'">'+ l10n.remove_file +'</a>)';
				}

				// add/display our output
				$formfield.siblings('.cmb_media_status').slideDown().html(uploadStatus);
			}
		}

		// When an file is selected, run a callback.
		cmb.file_frames[cmb.formfield].on( 'select', function() {
			var selection = cmb.file_frames[cmb.formfield].state().get('selection');
			var type = isList ? 'list' : 'single';
			handlers[type]( selection );
		});

		// Finally, open the modal
		cmb.file_frames[cmb.formfield].open();
	}

	cmb.handleRemoveMedia = function( event ) {
		var $self = $(this);
		if ( $self.is( '.attach_list .cmb_remove_file_button' ) ){
			$self.parents('li').remove();
			return false;
		}
		cmb.formfield    = $self.attr('rel');
		var $container   = $self.parents('.img_status');

		$metabox.find('input#' + cmb.formfield).val('');
		$metabox.find('input#' + cmb.formfield + '_id').val('');
		if ( ! $container.length ) {
			$self.parents('.cmb_media_status').html('');
		} else {
			$container.html('');
		}
		return false;
	}

	cmb.addAjaxRow = function( event ) {

		event.preventDefault();

		var $self         = $(this);
		var tableselector = '#'+ $self.data('selector');
		var inputselector = tableselector.slice(1,tableselector.lastIndexOf('repeat'));
		var $table        = $(tableselector).data('numberels', cmb.idNumber );
		var $emptyrow     = $table.find('.empty-row');
		cmb.idNumber      = parseInt( $emptyrow.find('[data-iterator]').data('iterator') ) + 1;
		var $row          = $emptyrow.clone();
		var prevNum       = cmb.idNumber - 1;
		var $colorPicker  = $row.find( '.wp-picker-container' );
		var $list         = $row.find( '.cmb_media_status' );
		var $newInput, $focusInput;

		// Need to clean-up colorpicker before appending
		if ( $colorPicker.length ) {
			var $td = $row.find( 'td:first-child' );
			$td.html( $td.find( 'input:text.cmb_colorpicker' ) );
		}

		// Need to clean-up colorpicker before appending
		if ( $list.length ) {
			$list.empty();
		}

		var cleanRow = function() {

			$newInput = $(this);
			$focusInput = $focusInput ? $focusInput : $newInput;

			var oldName = $newInput.attr( 'name' );
			var newName = oldName ? oldName.replace( prevNum, cmb.idNumber ) : '';
			var oldID = $newInput.attr( 'id' );
			var newID = oldID ? oldID.replace( '_'+ prevNum, '_'+ cmb.idNumber ) : '';
			var $next = $newInput.next();

			cmb.log( $newInput.prop('tagName'), oldName, newName, prevNum, cmb.idNumber );
			$newInput
				.val('')
				.removeAttr( 'checked' )
				.removeAttr( 'selected' )
				.removeClass( 'hasDatepicker' )
				.attr({
				  id: newID,
				  name: newName,
				  'data-iterator': cmb.idNumber,
				});
			if ( $next.is('label') ) {
				$next.attr( 'for', newID );
			}
		}

		// cmb.log( $newInput.attr('id'), $newInput.data('iterator'));
		$row.find('input:not([type="button"]),select,textarea').each( cleanRow );

		$emptyrow.removeClass('empty-row').addClass('repeat-row');
		$emptyrow.after( $row );
		if ( $focusInput ) {
			$focusInput.focus();
		}

		// Init pickers from new row
		cmb.initPickers( $row.find('input:text.cmb_timepicker'), $row.find('input:text.cmb_datepicker'), $row.find('input:text.cmb_colorpicker') );

	}

	cmb.removeAjaxRow = function( event ) {
		event.preventDefault();
		var $self   = $(this);
		var $parent = $self.parents('tr');
		var $table  = $self.parents('.cmb-repeat-table');

		// cmb.log( 'number of tbodys', $table.length );
		// cmb.log( 'number of trs', $('tr', $table).length );
		if ( $table.find('tr').length > 1 ) {
			if ( $parent.hasClass('empty-row') ) {
				$parent.prev().addClass( 'empty-row' ).removeClass('repeat-row');
			}
			$self.parents('.cmb-repeat-table tr').remove();
		}
	}

	/**
	 * @todo make work, always
	 */
	cmb.initPickers = function( $timePickers, $datePickers, $colorPickers ) {
		// Initialize timepicker
		cmb.initTimePickers( $timePickers );

		// Initialize jQuery UI datepicker
		cmb.initDatePickers( $datePickers );

		// Initialize color picker
		cmb.initColorPickers( $colorPickers );
	}

	cmb.initTimePickers = function( $selector ) {
		if ( ! $selector.length )
			return;

		$selector.timePicker({
			startTime: "00:00",
			endTime: "23:59",
			show24Hours: false,
			separator: ':',
			step: 30
		});
	}

	cmb.initDatePickers = function( $selector ) {
		if ( ! $selector.length )
			return;

		$selector.datepicker( "destroy" );
		$selector.datepicker();
	}

	cmb.initColorPickers = function( $selector ) {
		if ( ! $selector.length )
			return;
		if (typeof jQuery.wp === 'object' && typeof jQuery.wp.wpColorPicker === 'function') {

			$selector.wpColorPicker();

		} else {
			$selector.each( function(i) {
				$(this).after('<div id="picker-' + i + '" style="z-index: 1000; background: #EEE; border: 1px solid #CCC; position: absolute; display: block;"></div>');
				$('#picker-' + i).hide().farbtastic($(this));
			})
			.focus( function() {
				$(this).next().show();
			})
			.blur( function() {
				$(this).next().hide();
			});
		}
	}

	cmb.maybeOembed = function( evt ) {
		var $self = $(this);
		var type = evt.type;

		var m = {
			focusout : function() {
				setTimeout( function() {
					// if it's been 2 seconds, hide our spinner
					cmb.spinner( '.postbox table.cmb_metabox', true );
				}, 2000);
			},
			keyup : function() {
				var betw = function( min, max ) { return evt.which <= max && evt.which >= min; }
				// Only Ajax on normal keystrokes
				if ( betw( 48, 90 ) || betw( 96, 111 ) || betw( 8, 9 ) || evt.which == 187 || evt.which == 190 ) {
					// fire our ajax function
					cmb.doAjax( $self, evt);
				}
			},
			paste : function() {
				// paste event is fired before the value is filled, so wait a bit
				setTimeout( function() { cmb.doAjax( $self ); }, 100);
			}
		}
		m[type]();

	}

	/**
	 * Resize oEmbed videos to fit in their respective metaboxes
	 */
	cmb.resizeoEmbeds = function() {
		cmb.metabox().each( function() {
			var $self      = $(this);
			var $tableWrap = $self.parents('.inside');
			if ( ! $tableWrap.length )
				return true; // continue

			// Calculate new width
			var newWidth = Math.round(($tableWrap.width() * 0.82)*0.97) - 30;
			if ( newWidth > 639 )
				return true; // continue

			var $embeds   = $self.find('.cmb-type-oembed .embed_status');
			var $children = $embeds.children().not('.cmb_remove_wrapper');
			if ( ! $children.length )
				return true; // continue

			$children.each( function() {
				var $self     = $(this);
				var iwidth    = $self.width();
				var iheight   = $self.height();
				var _newWidth = newWidth;
				if ( $self.parents( '.repeat-row' ).length ) {
					// Make room for our repeatable "remove" button column
					_newWidth = newWidth - 91;
				}
				// Calc new height
				var newHeight = Math.round((_newWidth * iheight)/iwidth);
				$self.width(_newWidth).height(newHeight);
			});

		});
	}

	/**
	 * Safely log things if query var is set
	 * @since  1.0.0
	 */
	cmb.log = function() {
		if ( l10n.script_debug && console && typeof console.log === 'function' ) {
			console.log.apply(console, arguments);
		}
	}

	cmb.spinner = function( $context, hide ) {
		if ( hide )
			$('.cmb-spinner', $context ).hide();
		else
			$('.cmb-spinner', $context ).show();
	}

	// function for running our ajax
	cmb.doAjax = function($obj, e) {
		// get typed value
		var oembed_url = $obj.val();
		// only proceed if the field contains more than 6 characters
		if (oembed_url.length < 6)
			return;

		// only proceed if the user has pasted, pressed a number, letter, or whitelisted characters

			// get field id
			var field_id = $obj.attr('id');
			// get our inputs $context for pinpointing
			var $context = $obj.parents('.cmb-repeat-table  tr td');
			$context = $context.length ? $context : $obj.parents('.cmb_metabox tr td');

			var embed_container = $('.embed_status', $context);
			var oembed_width = $obj.width();
			var child_el = $(':first-child', embed_container);

			// http://www.youtube.com/watch?v=dGG7aru2S6U
			cmb.log( 'oembed_url', oembed_url, field_id );
			oembed_width = ( embed_container.length && child_el.length ) ? child_el.width() : $obj.width();

			// show our spinner
			cmb.spinner( $context );
			// clear out previous results
			$('.embed_wrap', $context).html('');
			// and run our ajax function
			setTimeout( function() {
				// if they haven't typed in 500 ms
				if ($('.cmb_oembed:focus').val() != oembed_url)
					return;
				$.ajax({
					type : 'post',
					dataType : 'json',
					url : l10n.ajaxurl,
					data : {
						'action': 'cmb_oembed_handler',
						'oembed_url': oembed_url,
						'oembed_width': oembed_width > 300 ? oembed_width : 300,
						'field_id': field_id,
						'object_id': $obj.data('objectid'),
						'object_type': $obj.data('objecttype'),
						'cmb_ajax_nonce': l10n.ajax_nonce
					},
					success: function(response) {
						cmb.log( response );
						// Make sure we have a response id
						if (typeof response.id === 'undefined')
							return;

						// hide our spinner
						cmb.spinner( $context, true );
						// and populate our results from ajax response
						$('.embed_wrap', $context).html(response.result);
					}
				});

			}, 500);
	}

	$(document).ready(cmb.init);

	return cmb;

})(window, document, jQuery);
