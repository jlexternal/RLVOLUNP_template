/**
 * jspsych-html-keyboard-response-faded
 *
 * Original by Josh de Leeuw
 * Fade in/out functionality added by Jun Seok LEE
 * REQUIREMENTS: jQuery
 *
 * plugin for fading in/out a stimulus and getting a keyboard response
 *
 * documentation: docs.jspsych.org
 *
 **/


jsPsych.plugins["html-keyboard-response-faded"] = (function() {

  var plugin = {};

  plugin.info = {
    name: 'html-keyboard-response-faded',
    description: '',
    parameters: {
      stimulus: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
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
        default: 1000,
        description: 'How long in milliseconds to fade in stimuli.'
      },
      fadeout_duration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Fade out duration',
        default: 500,
        description: 'How long in milliseconds to fade out stimuli.'
      },
      minimum_duration: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Minimum duration',
        default: null,
        description: 'Minimum duration after page is fully loaded before any keyboard input is taken.'
      },
    }
  }

  plugin.trial = function(display_element, trial) {

    var new_html = '<div id="jspsych-html-keyboard-response-faded-stimulus"; ' +
                        'class="hidden"; ' +
                        'style="display:none">' + trial.stimulus + '</div>';

    // add prompt
    if(trial.prompt !== null){
      new_html += trial.prompt;
    }

    // set content to be drawn
    display_element.innerHTML = new_html;

    // fade in
    $(document).ready(function() {
        $('div.hidden').fadeIn(trial.fadein_duration);
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
      //display_element.querySelector('#jspsych-html-keyboard-response-faded-stimulus').className += ' responded';

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

    // total duration of key freeze
    min_timeout_duration = trial.fadein_duration + trial.minimum_duration;

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
          display_element.querySelector('#jspsych-html-keyboard-response-faded-stimulus').style.visibility = 'hidden';
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
