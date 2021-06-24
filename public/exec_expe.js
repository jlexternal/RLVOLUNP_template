function exec_expe(task_data) {

/* BEGIN: Define commonly-called functions/stimuli here */
  function chosen_trialstim_fn(stims) {
    var chosen_trialstim_var = {
      type: "html-keyboard-response",
      stimulus: function(){
        if (jsPsych.data.get().last(1).values()[0].response == 'f') {
          return '<img src="' + stims[0]  + '"/><img src="img/shape_spacer.png" /><img src="img/shape_blank.png" />';
        }
        else {
          return '<img src="img/shape_blank.png"/><img src="img/shape_spacer.png" /><img src="' + stims[1]  + '" />';
        }
      },
      trial_duration: duration_fn(debugFlag,500,50),
      choices: jsPsych.NO_KEYS
    };
    return chosen_trialstim_var;
  }

  function feedback_fn(val) {
    var feedback_var = {
      type: 'html-keyboard-response',
      stimulus: function(){
        /* *************************************************************************
        Warning: the argument of 'last()'' must be the number of trials
          'feedback' is away from 'trialstim' in the timeline push below.
          e.g. 'timeline.push(trialstim, feedback_fn)' ->  'last(1)'

          (You may choose to pass an extra argument in the function and pass that value into
          last() to ameliorate the issue above in a more flexible way)
          */
        let last_trial_correct;
        if (debugFlag) {
          last_trial_correct = jsPsych.data.get().last(1).values()[0].correct; // hard coded
        } else {
          last_trial_correct = jsPsych.data.get().last(2).values()[0].correct; // hard coded
        }
        /* *************************************************************************  */
        let fb_str;
        if (last_trial_correct) {
          fb_str = val;
        } else {
          fb_str = 100-val;
        }
        return '<div style="font-size:60px">'+fb_str+'</div>';
      },
      choices: jsPsych.NO_KEYS,
      trial_duration: duration_fn(debugFlag,500,50),
    };
    return feedback_var;
  }

  var pre_block_ready = {
    type: 'html-keyboard-response-faded',
    stimulus: '<span style="font-weight:bold">When you are ready to begin the game, press spacebar</span>',
    choices: [' '],
    minimum_duration: duration_fn(debugFlag,1000,50),
  };

  function end_session_stim_fn(isesh) {
    var end_session_stim = {
      type: 'html-keyboard-response-min-duration',
      stimulus: function () {
        let igame = isesh + 1;
        return 'If you need to take a small break, you may do so here. <br><br>'+
          '<p style = "text-align: center; font-size: 20px; font-weight: bold">Press spacebar to continue to the next game.</p>';
      },
      choices: [' ']
    };
    return end_session_stim;
  }

  // send trial response data to server
  function post_response(data) {
    if (!isLocal) {
      $.ajax({
        url: '/post_resp',
        type: 'POST',
        data : data,
    //  success: function(response){console.log('SUCCESS response POST request!');},  //debug use
        error: function(error){
          console.log(error);
        }
      })
    //  .done((successFlag) => { console.log('response POST successFlag: '+ successFlag); }) //debug use
        .fail((xhr,txt,err) => { console.log('FAIL post_resp POST'); console.log(err); });
      }
  }

/* END: Define commonly called functions/stimuli here */


  // present consent form
  var check_consent = function(elem) {
    if (document.getElementById('consent_checkbox').checked) {
      return true;
    }
    else {
      alert("If you wish to participate, you must check the box next to the statement 'I agree to participate in this study.'");
      return false;
    }
    return false;
  };
  // declare the consent block
  var consent_trial = {
    type:'external-html',
    url: "consent_form/consentpg_rlvolunp.html",
    cont_btn: "startbutton",
    check_fn: check_consent
  };
  //timeline.push(consent_trial);

  // localize task data brought in from local files/server
  var rew_corr = task_data.traj;
  var idx_blocks = task_data.idx_blocks;

  console.log(rew_corr)
  // load shapes
  var shapes = [];
  shapes.push('img/shape_blank.png'); // to replace unchosen shape
  for (var i = 1; i<21; i++) {
    let imgStr = 'img/shape' + (i.toString()).padStart(2,'0') + '.png';
    shapes.push(imgStr);
  }

  // randomize the shapes to be presented
  var shape_pairs_randomized1 = jsPsych.randomization.shuffle([...Array(20).keys()].map(x => x+1)); // for 1st half of experiment
  var shape_pairs_randomized2 = jsPsych.randomization.shuffle([...Array(20).keys()].map(x => x+1)); // for 2nd half

  /* Preload .PNG files to be used as stimuli */
  var preload = {
    type: 'preload',
    images: function() {
      let images = ['img/blue.png', 'img/orange.png'];
      images = images.concat(shapes);
      return images;
    }
  };
  timeline.push(preload);


/*
//debug : testing SQL query types through a POST call
var test_trial = {
  type: 'html-keyboard-response',
  stimulus: 'pick either F or J or L',
  choices:  ['F','J','L'],
  on_finish: function (data) {
    if (jsPsych.pluginAPI.compareKeys(data.response, 'f')) {
        data.query = 'INSERT';
    } else if (jsPsych.pluginAPI.compareKeys(data.response, 'j')) {
        data.query = 'UPDATE';
    } else if (jsPsych.pluginAPI.compareKeys(data.response, 'l')) {
        data.query = 'OTHER';
    } else {
      console.log('NOTHING HIT');
    }
    $.ajax({
      url: '/testing',
      type: 'POST',
      data: data,
      success: function(response){
          console.log('SUCCESS testing POST request!');
       },
      error: function(error){
        console.log(error);
      }
    })
      .done((successFlag) => { console.log('test_trial POST successFlag: '+ successFlag); })
      .fail((xhr,txt,err) => { console.log('FAIL test_trial POST'); console.log(err); });
  }
};
*/

  var fullscreen = {
      type: 'fullscreen',
      showtext: '<p>To take part in the experiment, your browser must be in fullscreen mode.<br></br>Please click the button below to enable fullscreen mode and continue.</p>',
      buttontext: "Fullscreen",
  data: {trialType: 'instructions'}
  };

  var welcome_block = {
    type: 'html-keyboard-response-sequential-faded',
    stimulus: function () {
      var stim = {
        stimuli: ['<p style = "text-align: center; font-size: 28px"><br>Hello and welcome to the experiment!</p>',
      '<p style = "text-align: center; font-size: 28px; font-weight: bold">Press spacebar to continue.</p>']
      };
      return stim;
    },
    choices: [' '],
    fadein_duration: duration_fn(debugFlag,2000,100),
    fadeout_duration: duration_fn(debugFlag,200,100),
    individual_durations: function() {
      var dura_arr = [1500,200];
      return multiduration_fn(debugFlag,dura_arr,100);
    },
  };

  // welcome
//  timeline.push(fullscreen);
  timeline.push(welcome_block);

  var stims_ab = ['img/shape_train01.png','img/shape_train02.png'];
  var example_trial = {
    type: "html-keyboard-response",
    stimulus: function(){
      return '<img src="' + stims_ab[0]  + '"/><img src="img/shape_spacer.png" /><img src="' + stims_ab[1]  + '" />';
    },
    choices: ['f','j'], // response set
    data: {
      task: 'response'
    }
  };

  var post_example_trial = {
    type: "html-keyboard-response-sequential-faded",
    stimulus: function () {
      var stim = {
        stimuli: ['As you saw, a trial begins with the presentation of the two options you have.<br><br>',
        "After your choice is made, the chosen shape will remain, the unchosen shape disappears, "+
        "and you will see the points associated with the option.<br><br>",
        '<span style = "font-weight: bold">'+
        'Be sure to pay attention to the location of your desired shape, as they may switch sides from time to time.</span><br><br>',
        '<span style = "font-style:italic; font-size:30px">'+
          '<span style="font-weight:bold">F</span> corresponds to the shape on the <span style="font-weight:bold">LEFT</span><br>'+
          'and <span style="font-weight:bold">J</span> corresponds to the shape on the <span style="font-weight:bold">RIGHT</span>'+
        '</span>',
        '<p style = "text-align: center; font-size: 28px; font-weight: bold">Press spacebar to continue.</p>']
      };
      return stim;
    },
    choices: [' '],
    fadein_duration: duration_fn(debugFlag,1000,100),
    fadeout_duration: duration_fn(debugFlag,200,100),
    minimum_duration: duration_fn(debugFlag,2000,100),
    individual_durations: () => {
      if (debugFlag) {
          return {durations: []};
      } else {
          return {durations: [3500,2500,3000,3000,500]};
      }
    }
  };
  timeline.push(example_trial,chosen_trialstim_fn(stims_ab),feedback_fn(50),post_example_trial);

  var n_sessions  = 6; // hard-coded
  var choice_opts = ['f','j']; // set of available keys to choices
  var cond_types  = ['REF','VOL','UNP'];

  /* Determine order of conditions based on odd/even participant number */
  var cond_order;
  if (subj_num % 2 == 1) {
    cond_order = [1,2,3,1,2,3]; // REF, VOL, UNP, REF, VOL, UNP
  } else {
    cond_order = [1,3,2,1,3,2]; // REF, UNP, VOL, REF, UNP, VOL
  }

  var total_score = 0; // total score for calculating bonus at the end

  /* Session loop */
  for (var isesh=0; isesh<n_sessions; isesh++) {
    let cond_type = cond_types[cond_order[isesh]-1];
    let game_label;

    var n_trials  = rew_corr[isesh].length; // number of trials
    var fb_vals   = rew_corr[isesh];        // feedback values for the correct option

    /* initial instructions for whatever condition */
    let init_cond_instruction_str;
    switch (cond_order[isesh]) {
      case 1: // instructions for REF condition
        game_label = '<span style = "font-weight:bold">Slot machine 1</span>';
        init_cond_instruction_str = 'ref_instructions';
        break;
      case 2: // instructions for VOL condition
        game_label = '<span style = "font-weight:bold">Slot machine 3</span>';
        init_cond_instruction_str = 'vol_instructions';
        break;
      case 3: // instructions for UNP condition
        game_label = '<span style = "font-weight:bold">Slot machine 2</span>';
        init_cond_instruction_str = 'unp_instructions';
        break;
    }

    let idx_blocks_half;
    // push specific instructions and training for the 1st instance of any condition
    if (isesh < 3) {
      idx_blocks_half = 0;
    } else {
      idx_blocks_half = 1;
    }
    // push ready screen for the first block only
    if (isesh == 0) {
      timeline.push(pre_block_ready);
    }

    /* Generate random placement of the correct choice */
    var cor_locs  = Array.from({length: n_trials}, () => Math.round(Math.random()));

    /* Localize stimuli for the current session */
    let stimulis;
    if (cond_order[isesh] == 2) { // for VOL session
      stimulis = ['img/blue.png','img/orange.png'];
    }
    else { // for REF and UNP
      stimulis = shapes;
    }

    /* Trial loop */
    let irnd_prev;
    let igame = isesh+1;
    let score = 0;
    for (var itrl=0; itrl<n_trials; itrl++){
      let irnd_curr = idx_blocks[idx_blocks_half][itrl]; // block index on current trial; starts from 1 (imported from MATLAB)
      var n_rounds  = 5; // hard coded

      /* Localize indexed variables */
      let stim_loc   = cor_locs[itrl];
      let cor_choice; // either 'f' or 'j'
      cor_choice = choice_opts[stim_loc]; // location from cor_locs
      if (cond_order[isesh] == 2) {
        if (irnd_curr % 2 == 0) {
          cor_choice = choice_opts[-stim_loc+1]; // invert correct choice
        }
      }
      /*
        Calculate the random combination of the shape sets to be presented for any round
      */
      let stims;
      if (cond_order[isesh] != 2) { // for REF and UNP, need to cycle through shapes
        if (isesh < 3) { // 1st half
          if (cond_order[isesh]==1) { //REF
            //DEBUG: this part needs to get cleaned up to be more legible (but it is still functional)
            stims = [stimulis[shape_pairs_randomized1[stim_loc+2*(idx_blocks[idx_blocks_half][itrl]-1)]],
                     stimulis[shape_pairs_randomized1[-stim_loc+1+2*(idx_blocks[idx_blocks_half][itrl]-1)]]];
          } else { // UNP
            stims = [stimulis[shape_pairs_randomized1[stim_loc+2*(idx_blocks[idx_blocks_half][itrl]-1)+10]],
                     stimulis[shape_pairs_randomized1[-stim_loc+1+2*(idx_blocks[idx_blocks_half][itrl]-1)+10]]];
          }
        } else { // 2nd half
          if (cond_order[isesh]==1) { //REF
            stims = [stimulis[shape_pairs_randomized2[stim_loc+2*(idx_blocks[idx_blocks_half][itrl]-1)]],
                     stimulis[shape_pairs_randomized2[-stim_loc+1+2*(idx_blocks[idx_blocks_half][itrl]-1)]]];
          } else { // UNP
            stims = [stimulis[shape_pairs_randomized2[stim_loc+2*(idx_blocks[idx_blocks_half][itrl]-1)+10]],
                     stimulis[shape_pairs_randomized2[-stim_loc+1+2*(idx_blocks[idx_blocks_half][itrl]-1)+10]]];
          }
        }
      }
      else { // for VOL, maintain the same shape set for entire session
        stims = [stimulis[stim_loc], stimulis[-stim_loc+1]];
      }

      // Stimulus that indicates a switch trial
      if (itrl > 0) {
        if (irnd_curr != irnd_prev) {
          var debug_switch_trial;
          if (debugFlag) {
            debug_switch_trial = {
              type: 'html-keyboard-response',
              stimulus: 'switch trial',
              choices: jsPsych.NO_KEYS,
              trial_duration: duration_fn(debugFlag,1000,50),
            };
            timeline.push(debug_switch_trial);
          }
        }
      }
      irnd_prev = idx_blocks[idx_blocks_half][itrl]; // block index on the previous trial; there should be no calls of irnd_prev after this assignment

      // main option stimuli
      var trialstim = {
        type: "html-keyboard-response",
        stimulus: function() {
          return '<img src="' + stims[0]  + '"/><img src="img/shape_spacer.png" /><img src="' + stims[1]  + '" />';
        },
        choices: ['f','j'], // response set
        data: {
          task: 'response',
          correct_response: jsPsych.timelineVariable('correct_response'),
          cond_expe: cond_type,
          block_expe: isesh+1,
          trial_expe: itrl+1,
          round_expe: irnd_curr,
          corr_fb: fb_vals[itrl],
        },
        on_finish: function(data) {
          let resp_data = {}; // JSON object to send to server

          resp_data.unique_id = unique_id; // brought in from run_expe.html
          resp_data.cond      = this.data.cond_expe;
          resp_data.i_block   = this.data.block_expe;
          resp_data.i_round   = this.data.round_expe;
          resp_data.i_trial   = this.data.trial_expe;

          // correct/incorrect flag for trial
          if(jsPsych.pluginAPI.compareKeys(data.response, cor_choice)){
            data.correct = true;
            resp_data.seen_feedback = this.data.corr_fb;
            score++;        // for end-of-block feedback
            total_score++;  // for bonus
          } else {
            data.correct = false;
            resp_data.seen_feedback = 100-this.data.corr_fb;
          }
          resp_data.is_correct = data.correct;
          let resp_side;
          switch (data.response) {
            case 'f':
              resp_side = 0;
              resp_data.choice_position = 'L';
              break;
            case 'j':
              resp_side = 1;
              resp_data.choice_position = 'R';
              break;
          }
          if (this.data.cond_expe != 'VOL') {
            console.log(stims[resp_side])
            resp_data.choice_symbol = Number(stims[resp_side].slice(9,11)); // slice positions hard coded
          } else {
            if (stims[resp_side][4] == 'b') {
            } else {
                resp_data.choice_symbol = 98; //orange
            }
          }
          resp_data.reaction_time = Math.round(data.rt);
          post_response(resp_data); // send data to server
        }
      };

      var chosen_trialstim = chosen_trialstim_fn(stims);     // choice option chosen stimulus
      let val = fb_vals[itrl];
      var feedback = feedback_fn(val); // feedback stimulus

      var debug_data = {
        type: 'html-keyboard-response',
        stimulus: itrl+1,
        choices: jsPsych.NO_KEYS,
        trial_duration: 10
      };

      var debug_data2 = { // feedback for correct/incorrect
        type: 'html-keyboard-response',
        stimulus: function(){
          let last_trial_correct = jsPsych.data.get().last(2).values()[0].correct;
          if (last_trial_correct) {
            return "correct";
          } else {
            return "wrong";
          }
        },
        choices: jsPsych.NO_KEYS,
        trial_duration: 10
      };

      // general stimulus and feedback push
      if (debugFlag) {
        timeline.push(debug_data, trialstim, feedback, debug_data2);
      }
      else {
        timeline.push(trialstim, chosen_trialstim, feedback);
      }

      // end of block presentation and score feedback
      if (itrl == n_trials-1) {
        // score feedback for the precedent game/session
        var trialstim_end_block_feedback = {
          type: 'html-keyboard-response-min-duration',
          stimulus: function() {
            return 'End of <span style = "font-weight: bold">Game ' + igame+ '</span><br><br>' +
              'Your total score for <span style = "font-weight:bold">Game '+ igame + '</span>' +
              ' is <br><br><span style = "font-size: 32px">' + score + '/' + n_trials + '</span>' +
              '<br><br><p style = "text-align: center; font-size: 28px; font-weight: bold">Press spacebar to continue</p>';
          },
          choices: [' '],
          minimum_duration: duration_fn(debugFlag,2000,200),
        };
        timeline.push(trialstim_end_block_feedback);
        // push end of block screen for all except the last block
        if (isesh != n_sessions-1) {
          timeline.push(end_session_stim_fn(isesh));
        }
      }
    } // end trial loop

    if (isesh == 2) {
      var trialstim_end_of_first_half = {
        type: 'html-keyboard-response-min-duration',
        stimulus: function() {
          return 'This is the end of the 1st half of the experiment.<br><br>'+
            'In the next half, you will see the same symbols you encountered in the first half, but their values do not carry over.<br><br>'+
            'If you need to take a short pause, you may do so now.<br><br>'+
            '<br><br><p style = "text-align: center; font-size: 28px; font-weight: bold">Press spacebar to continue</p>';
        },
        choices: [' '],
        minimum_duration: duration_fn(debugFlag,5000,100),
      };
      timeline.push(trialstim_end_of_first_half);
    }
  } // end block loop

  var trialstim_end_of_second_half = {
    type: 'html-keyboard-response-min-duration',
    stimulus: function() {
      return 'This is the end of the game.<br><br>'+
        'We will ask you a few questions to get your feedback on the experiment.<br><br>'+
        '<p style = "text-align: center; font-size: 28px; font-weight: bold">Press spacebar to continue</p>';
    },
    choices: [' '],
    minimum_duration: duration_fn(debugFlag,2000,100),
  };
  timeline.push(trialstim_end_of_second_half);

  // ask for feedback from participant about the task
  participant_feedback();

  // end of experiment presentation
  var end_experiment_stim = {
    type: 'html-keyboard-response',
    stimulus: 'End of experiment.<br><br>Thank you for your participation!<br><br>'+
              'In case you are not automatically redirected, the completion code is: 1D952092<br><br>'+
              '<span style = "font-weight: bold">For an additional payment of £2.5, '+
              'please participate in our mental health survey questionnaire study (to be posted later).</span><br><br>' +
              '<br><br>Please wait for this message to disappear before closing the browser (approximately in 7 seconds).',
    choices: [' '],
    minimum_duration: 5000,
    trial_duration: 7000,
    on_finish: function () {
      if (!isLocal) {
        if (total_score >= 258) {
          /*  258 is the lowest number of points that passes binomial test with p < .05
              (i.e. 1-BinomialCDF(n=480,k=258,p=0.5) < 0.05)  */

          // send post to server to update participant's bonus status
            $.ajax({
              url: '/bonus',
              type: 'POST',
              data: {unique_id: unique_id},
              success: function(response) {
                console.log('SUCCESS bonus POST request!');
              },
              error: function(error){
                console.log(error);
              }
            });
        }
        $.ajax({
          url: '/end_task',
          type: 'POST',
          data: {unique_id: unique_id},
          success: function(response){
              console.log('SUCCESS end_task POST request!');
           },
          error: function(error){
            console.log(error);
          }
        })
          //.done((successFlag) => { console.log('end_task POST successFlag: '+ successFlag); })
          .fail((xhr,txt,err) => { console.log('FAIL end_task POST'); console.log(err); });

      }
    }
  };
  timeline.push(end_experiment_stim);

  // prompt confirming browser is now safe to close
  var end_everything = {
    type: 'html-keyboard-response',
    stimulus: 'You are being redirected to the Prolific platform. Do not close the browser...',
    choices: jsPsych.NO_KEYS,
    trial_duration: 1000,
  };
  timeline.push(end_everything);

  /* Execute timeline */
  jsPsych.init({
    timeline: timeline,
    minimum_valid_rt: 100,
    on_finish: function() {

      // redirect client to completion page on Prolific
      window.location = "https://app.prolific.co/submissions/complete?cc=1D123456"; //debug : The current code is for the Pilot (Prolific)

      // jsPsych.data.get().localSave('csv','mydata.csv'); // save csv file locally
      // jsPsych.data.displayData();
    }
  });
} // end function exec_expe
