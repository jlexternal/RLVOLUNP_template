/**
 * jspsych-html-keyboard-response-sequential-faded
 *
 * Original by Josh de Leeuw
 * Fade in/out functionality added by Jun Seok LEE
 * REQUIREMENTS: jQuery
 *
 * plugin for fading in/out a stimulus and getting a keyboard response
 *
 * The stimuli must be provided in an array inside of an object for the
 * plugin to properly parse and present them
 *
 * documentation: docs.jspsych.org
 *
 **/

jsPsych.plugins["html-keyboard-response-sequential-faded"] = (function() {

  var plugin = {};

  plugin.info = {
    name: 'html-keyboard-response-sequential-faded',
    description: '',
    parameters: {
      stimulus: {
        type: jsPsych.plugins.parameterType.OBJECT,
        pretty_name: 'Stimulus',
        default: undefined,
        description: 'The HTML string to be displayed'
      },
      choices: {
        type: jsPsych.plugins.parameterType.KEY,
        array: true,
        pretty_name: 'Choices',
        default: jsPsych.ALL_KEYS,
        description: 'The keys the subject is allowed to press to respond to the stimulus.'
      },
      prompt: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Prompt',
        default: null,
        description: 'Any content here will be displayed below the stimulus.'
      },
      stimulus_duration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Stimulus duration',
        default: null,
        description: 'How long to hide the stimulus.'
      },
      trial_duration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Trial duration',
        default: null,
        description: 'How long to show trial before it ends.'
      },
      response_ends_trial: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: 'Response ends trial',
        default: true,
        description: 'If true, trial will end when subject makes a response.'
      },
      fadein_duration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Fade in duration',
        default: 1500,
        description: 'How long in milliseconds to fade in stimuli.'
      },
      fadeout_duration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Fade out duration',
        default: 800,
        description: 'How long in milliseconds to fade out stimuli.'
      },
      minimum_duration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Minimum duration',
        default: null,
        description: 'Minimum duration after page is fully loaded before any keyboard input is taken.'
      },
      individual_durations: {
        type: jsPsych.plugins.parameterType.OBJECT,
        pretty_name: 'Fade in durations for the elements of the HTML array',
        default: {durations: []},
        description: 'Object with an array of integers (milliseconds) specifying the presentation durations of each element of the HTML array.'
      },
    }
  };

  plugin.trial = function(display_element, trial) {

    // parse contents of stimulus objects
    var stimuli_html = '';
    var div_labels = '';
    var ind_durations = [];
    var min_timeout_duration; // ignores input from user until this duration has passed

    const arrSum = arr => arr.reduce((a,b) => a + b, 0); // array sum function

    // ensure that the number of durations is equivalent to the number of durations provided (given it is provided)
    if (trial.individual_durations.durations.length !== 0) {
      if (trial.individual_durations.durations.length !== trial.stimulus.stimuli.length) {
          // If the number of provided stimuli and the individual durations do not match, stop execution
          console.error('The number of stimuli objects to be displayed does not equal the number of durations!');
          window.stop();
      } else { // Else, set the individual durations
          ind_durations = trial.individual_durations.durations;
          min_timeout_duration = arrSum(ind_durations) + trial.minimum_duration + trial.fadeout_duration;
      }
    } else { // use the value from the fadein_duration parameter
        ind_durations.length = trial.stimulus.stimuli.length;
        ind_durations.fill(1);
        ind_durations = ind_durations.map(function(x){return x*trial.fadein_duration;});
        min_timeout_duration = (trial.fadein_duration * trial.stimulus.stimuli.length) + trial.minimum_duration + trial.fadeout_duration;
    }

    //loop through the different stimuli and assign them in individual div containers (automatic naming)
    for (i=0; i<trial.stimulus.stimuli.length; i++) {
      let div_label = '<div id = "word'+ i + '" class = "words"';
      let div_wrapped_stim = div_label + '"; style = "opacity: 0">' +
                             trial.stimulus.stimuli[i] + '</div>';
      stimuli_html = stimuli_html+div_wrapped_stim;
      div_labels = div_labels + div_label;
    }

    var new_html = '<div id ="jspsych-html-keyboard-response-sequential-faded-stimulus"; class = "hidden">' + stimuli_html + '</div>';

    // add prompt
    if(trial.prompt !== null){
      new_html += trial.prompt;
    }

    // set content to be drawn
    display_element.innerHTML = new_html;

    // calculate delay times based on individual fade-in durations
    var delays = [0];
    for (i=0; i<ind_durations.length-1; i++) {
      delays.push(arrSum(ind_durations.slice(0,i+1)));
    }

    // fade in sequentially
    $(document).ready(function() {
        $('.words').each(function (i) {
          $(this).delay(delays[i]).animate({"opacity": "1"},ind_durations[i]);
        });
    });

    // store response
    var response = {
      rt: null,
      key: null
    };

    // function to end trial when it is time
    var end_trial = function() {

      // kill any remaining setTimeout handlers
      jsPsych.pluginAPI.clearAllTimeouts();

      // kill keyboard listeners
      if (typeof keyboardListener !== 'undefined') {
        jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }

      // gather the data to store for the trial
      var trial_data = {
        rt: response.rt,
        stimulus: trial.stimulus,
        response: response.key
      };

      // clear the display
      //display_element.innerHTML = '<div class="hidden"> </div>';

      // move on to the next trial
      jsPsych.finishTrial(trial_data);
    };

    // function to handle responses by the subject
    var after_response = function(info) {

      // after a valid response, the stimulus will have the CSS class 'responded'
      // which can be used to provide visual feedback that a response was recorded
      //display_element.querySelector('#jspsych-html-keyboard-response-sequential-faded-stimulus').className += ' responded';

      // only record the first response
      if (response.key == null) {
        response = info;
      }

      if (trial.response_ends_trial) {
        // fade out
        $(document).ready(function() {
            $('div.hidden').fadeOut(trial.fadeout_duration);
        });
        jsPsych.pluginAPI.setTimeout(function() {
          end_trial();
        }, trial.fadeout_duration);
      }
    };

    // start the response listener
    jsPsych.pluginAPI.setTimeout(function() {
      if (trial.choices != jsPsych.NO_KEYS) {
        var keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: after_response,
          valid_responses: trial.choices,
          rt_method: 'performance',
          persist: false,
          allow_held_key: false
        });
      }

      // hide stimulus if stimulus_duration is set
      if (trial.stimulus_duration !== null) {
        jsPsych.pluginAPI.setTimeout(function() {
          display_element.querySelector('#jspsych-html-keyboard-response-sequential-faded-stimulus').style.visibility = 'hidden';
        }, trial.stimulus_duration);
      }

      // end trial if trial_duration is set
      if (trial.trial_duration !== null) {
        leaving_timeout_duration = Math.max(trial.trial_duration,trial.fadeout_duration);
        $(document).ready(function() {
            $('div.hidden').fadeOut(trial.fadeout_duration);
        });
        jsPsych.pluginAPI.setTimeout(function() {
          end_trial();
        }, leaving_timeout_duration);
      }

    }, min_timeout_duration);

  };

  return plugin;
})();
