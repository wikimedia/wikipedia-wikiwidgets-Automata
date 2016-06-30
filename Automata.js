/**
 * Automata is a simple widget for Wikipedia articles about elementary cellular automata.
 * It's part of the WikiWidgets project, aimed at helping readers understand topics through interactive widgets.
 * https://commons.wikimedia.org/wiki/Commons:WikiProject_WikiWidgets
 *
 * Written by Felipe Schenone in 2016
 *
 * Automata is available under the GNU General Public License (http://www.gnu.org/licenses/gpl.html)
 */
var Automata = {

	/**
	 * Localisation messages
	 */
	messages: {
		'en': {
			'rule-input-placeholder': 'Rule',
			'rule-input-tooltip': 'Rule number',
			'previous-rule-button': 'Previous',
			'previous-rule-button-tooltip': 'Previous rule',
			'next-rule-button': 'Next',
			'next-rule-button-tooltip': 'Next rule',
			'center-button': 'Center',
			'random-button': 'Random',
		},
		'es': {
			'rule-input-placeholder': 'Regla',
			'rule-input-tooltip': 'Número de regla',
			'previous-rule-button': 'Siguiente',
			'previous-rule-button-tooltip': 'Regla siguiente',
			'next-rule-button': 'Siguiente',
			'next-rule-button-tooltip': 'Regla siguiente',
			'center-button': 'Centrado',
			'random-button': 'Disperso',
		}
	},

	/**
	 * Initialisation script
	 */
	init: function () {
		// Set the interface language
		var lang = mw.config.get( 'wgUserLanguage' );
		if ( ! ( lang in Automata.messages ) ) {
			lang = 'en'; // Fallback to English
		}
		mw.messages.set( Automata.messages[ lang ] );

		// Build one widget per tag
		$( '.WikiWidget[data-wikiwidget="Automata"]' ).each( function () {
			var gui = new Automata.GUI( this ),
				board = new Automata.Board( gui );

			gui.bind( board );

			board.init();
		});
	},

	/**
	 * Graphical User Interface
	 */
	GUI: function ( wrapper ) {

		this.wrapper = $( wrapper );

		this.container = $( '<div>' ).addClass( 'AutomataContainer' );

		this.canvas = $( '<canvas>' ).addClass( 'AutomataCanvas' );

		this.menu = $( '<div>' ).addClass( 'AutomataMenu' );

		this.ruleInput = $( '<input>' ).attr({
			'class': 'AutomataInput AutomataRuleInput',
			'title': mw.message( 'rule-input-tooltip' ),
			'placeholder': mw.message( 'rule-input-placeholder' ),
		});

		this.previousRuleButton = $( '<img>' ).attr({
			'class': 'AutomataButton AutomataPreviousRuleButton',
			'src': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/WikiWidgetResetButton.png',
			'title': mw.message( 'previous-rule-button-tooltip' ),
			'alt': mw.message( 'previous-rule-button' )
		});

		this.nextRuleButton = $( '<img>' ).attr({
			'class': 'AutomataButton AutomataNextRuleButton',
			'src': 'https://upload.wikimedia.org/wikipedia/commons/6/63/WikiWidgetNextButton.png',
			'title': mw.message( 'next-rule-button-tooltip' ),
			'alt': mw.message( 'next-rule-button' )
		});

		this.centerButton = $( '<button>' ).attr({
			'class': 'AutomataButton AutomataCenterButton'
		}).text( mw.message( 'center-button' ) );

		this.randomButton = $( '<button>' ).attr({
			'class': 'AutomataButton AutomataRandomButton'
		}).text( mw.message( 'random-button' ) );

		// Put it all together
		this.menu.append(
			this.previousRuleButton,
			this.ruleInput,
			this.nextRuleButton,
			this.centerButton,
			this.randomButton
		);
		this.container.append(
			this.canvas,
			this.menu
		);
		this.wrapper.html( this.container );

		/**
		 * Event binding
		 */
		this.bind = function ( board ) {
			this.previousRuleButton.click( function () {
				board.previousRule();
			});
			this.nextRuleButton.click( function () {
				board.nextRule();
			});
			this.ruleInput.change( function () {
				board.setRule( $( this ).val() );
				board.gui.update( board );
				board.refill();
			});
			this.centerButton.click( function () {
				board.setSeed( 'center' );
				board.gui.update( board );
				board.refill();
			});
			this.randomButton.click( function () {
				board.setSeed( 'random' );
				board.gui.update( board );
				board.refill();
			});
		};

		this.update = function ( board ) {
			this.canvas[0].width = board.width;
			this.canvas[0].height = board.height;
			this.ruleInput.val( board.rule );
			if ( board.seed === 'random' ) {
				this.randomButton.addClass( 'AutomataButtonSelected' );
				this.centerButton.removeClass( 'AutomataButtonSelected' );
			} else {
				this.centerButton.addClass( 'AutomataButtonSelected' );
				this.randomButton.removeClass( 'AutomataButtonSelected' );
			}
		};
	},

	Board: function ( gui ) {

		this.gui = gui;

		this.canvas = gui.canvas[0];

		this.context = this.canvas.getContext( '2d' );

		this.width = 300;

		this.height = 150;

		this.rule = 0;

		this.seed = 'center';

		/**
		 * These arrays hold the x-coordinates of the live cells
		 */
		this.newLiveCells = [];
		this.oldLiveCells = [];

		/**
		 * Initialisation script
		 */
		this.init = function () {
			this.setWidth( this.gui.wrapper.data( 'width' ) );
			this.setHeight( this.gui.wrapper.data( 'height' ) );
			this.setRule( this.gui.wrapper.data( 'rule' ) );
			this.setSeed( this.gui.wrapper.data( 'seed' ) );
			this.gui.update( this );
			this.fill();
		};

		/* Getters */

		/**
		 * Take a number representing the x-coordinate of a cell
		 * Return the old state of the cell
		 */
		this.getOldState = function ( x ) {
			if ( this.oldLiveCells.indexOf( x ) === -1 ) {
				return 0; // Dead
			}
			return 1; // Alive
		};

		/**
		 * Transform the seed into an array of x-coordinates
		 */
		this.getSeedArray = function () {
			if ( this.seed === 'random' ) {
				var seedArray = [];
				for ( var x = -this.width; x < this.width * 2; x++ ) {
					if ( Math.random() < 0.1 ) {
						seedArray.push( x );
					}
				}
				return seedArray;
			}
			return [ 0 ]; // If the seed isn't "random", it's "center"
		};

		/* Setters */

		this.setWidth = function ( value ) {
			value = parseInt( value );
			if ( isNaN( value ) ) {
				value = 300;
			} else if ( value < 100 ) {
				value = 100;
			} else if ( value > 1000 ) {
				value = 1000;
			}
			this.width = value;
		};

		this.setHeight = function ( value ) {
			value = parseInt( value );
			if ( isNaN( value ) ) {
				value = 150;
			} else if ( value < 100 ) {
				value = 100;
			} else if ( value > 1000 ) {
				value = 1000;
			}
			this.height = value;
		};

		this.setSeed = function ( value ) {
			if ( value === 'random' ) {
				this.seed = 'random';
			} else {
				this.seed = 'center';
			}
		};

		this.setRule = function ( value ) {
			value = parseInt( value );
			if ( isNaN( value ) ) {
				value = 0;
			}
			value = Math.round( value );
			if ( value < 0 ) {
				value = 0;
			}
			if ( value > 255 ) {
				value = 255;
			}
			this.rule = value;
		};

		/* Actions */

		this.previousRule = function () {
			this.rule--;
			this.gui.update( this );
			this.refill();
		};

		this.nextRule = function () {
			this.rule++;
			this.gui.update( this );
			this.refill();
		};

		/**
		 * Fill the board based on the rule
		 * This method is the heart of the widget
		 */
		this.fill = function () {
			// Set and draw the initial conditions
			this.oldLiveCells = this.getSeedArray();
			for ( var x of this.oldLiveCells ) {
					this.fillCell( x, 0 );
			}

			// Calculate the rest
			var rule = this.rule.toString( 2 ), // Convert to binary
				rule = Automata.pad( rule, 8 ); // Add leading zeros

			for ( var y = 1; y < this.height; y++ ) {
				/**
				 * Important! We need to calculate from way before the start of the image to way after the end
				 * because if not the code will asume that everything beyond the image is black (dead)
				 * but under many rules it isn't
				 */
				for ( var x = -this.width; x < this.width * 2; x++ ) {
					var left = this.getOldState( x - 1 ),
						center = this.getOldState( x ),
						right = this.getOldState( x + 1 ),
						input = '' + left + center + right, // Concatenate as string
						input = parseInt( input, 2 ), // Convert to decimal
						newState = rule.charAt( 7 - input ),
						newState = parseInt( newState ); // Convert to integer

					if ( newState === 0 ) {
						continue;
					}

					this.newLiveCells.push( x );
					this.fillCell( x, y );
				}
				this.oldLiveCells = this.newLiveCells;
				this.newLiveCells = [];
			}
		};

		this.clear = function () {
			this.newLiveCells = [];
			this.oldLiveCells = [];
			this.context.clearRect( 0, 0, this.canvas.width, this.canvas.height );
		};

		this.refill = function () {
			this.clear();
			this.fill();
		};

		this.fillCell = function ( x, y ) {
			this.context.fillStyle = 'white';
			this.context.fillRect( x + this.width / 2, y, 1, 1 ); // We add half the width so that the 0 coordinate is at the center
		};
	},

	/* Helpers */

	/**
	 * Add leading zeroes
	 */
	pad: function ( number, width ) {
		return number.length < width ? Automata.pad( '0' + number, width ) : number;
	}
}

jQuery( Automata.init );