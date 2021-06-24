module.exports = {

// creates the tables and their columns inside specified database
create_tables: async function() {
  var query_str = [];

  // create main_table
  //  This table should only be editable but not added to
  query_str.push(
    "CREATE TABLE main_table("+
      "isubj INT NOT NULL, "+                                  // subject number
      "unique_id CHAR(13) NOT NULL, "+                         // participant unique ID (from experiment)
      "prolific_id CHAR(24), "+                                // 24 char Prolific ID
      "task_completion_flag BOOL, "+                           // whether task is done
      "questionnaire_completion_flag BOOL, "+                  // whether questionnaire is done
      "bonus_flag BOOL, "+                                     // flag to determine participant bonus
      "timestamp_init TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "+  // time when entry was created
      "timestamp_task_start TIMESTAMP NULL, "+                 // time when prolific_id added
      "timestamp_task_end TIMESTAMP NULL, "+                   // time when task finished
      "timestamp_ques_start TIMESTAMP NULL, "+                 // time when questionnaire started
      "timestamp_ques_end TIMESTAMP NULL, "+                   // time when questionnaire finished
      "feedback TEXT, "+                                       // feedback from participant
      "UNIQUE (prolific_id), "+      // this table cannot have multiple prolific IDs
      "PRIMARY KEY (unique_id) );"   // the unique ID is the input of hash function to other tables
    );
  // create task_table
  //  This table, once filled by experimenter, should not be editable or added to
  query_str.push(
    "CREATE TABLE task_table("+
      "unique_id CHAR(13), "+
      "cond CHAR(3), "+
      "i_block INT, "+
      "i_round INT, "+
      "i_trial INT, "+
      "correct_choice_feedback INT );"
  );
  // create resp_table
  //  This table should be empty and added to during task, but not editable.
  query_str.push(
    "CREATE TABLE resp_table("+
      "unique_id CHAR(13), "+
      "cond CHAR(3), "+
      "i_block INT, "+
      "i_round INT, "+
      "i_trial INT, "+
      "seen_feedback INT, "+
      "is_correct BOOL, "+             // 0:false, 1: true
      "choice_position CHAR(1), "+     // L:left, R:right
      "choice_symbol INT, "+
      "reaction_time INT, "+           // RT values in units of ms
      "timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP );"
  );
  // create ques_table
  //  This table should be empty and added at the end of the questionnaire
  query_str.push(
    "CREATE TABLE ques_table ("+
      "unique_id CHAR(13), "+
      "label VARCHAR(20), "+
      "responses TEXT );"
  );

  return query_str;
},

// populate the default values of the main table
populate_main_table: async function (nsubj) {
  // argument of function is the total number of subjects : nsubj
  var fs        = require('fs');
  var query_str = [];

  for (let isubj=1;isubj<nsubj+1; isubj++) {
    // parse through folder names
    let idxs = [];
    let enumerator_id = isubj;
    let subj_dir      = 'subj_'+String(isubj).padStart(3,'0'); // pad 0's to subject number (enumerator_id)
    let unique_id;
    var filenames     = fs.readdirSync(__dirname+'/public/csvs/'+subj_dir); // get filenames in subject CSV folder
    // find the unique_id and store it
    for await (var filename of filenames) {
      // this loop is to get the unique_id from the idx_epi CSV
      var slice_end = filename.length-4;
      if (filename.slice(0,7)=='idx_epi') {
          unique_id = filename.slice(8,slice_end);
          filename_idx = filename;
      } else {
          console.error('\'idx_epi\' files were not found in the folder!'); // this will hit even with success for some reason (to debug later)
      }
    }
    query_str.push("INSERT INTO main_table (isubj, unique_id) " +
                    "VALUES ("+isubj+', "'+unique_id+'");');
  }
  return query_str;
},

// asynchronous function to take CSV data, parse into JSON object, query into mySQL database tables
populate_task_table: async function (nsubj,nblock,ntrial) {
  var fs        = require('fs');
  var readline  = require('readline');
  // experimental setup parameters (from experimenter)
  var cond_types  = ["REF","VOL","UNP"];
  var query_str = [];

  // go through the subject list and their corresponding files and database queries
  for (let isubj=1;isubj<nsubj+1; isubj++) {
    // parse through folder names
    let enumerator_id = isubj;
    let subj_dir      = 'subj_'+String(isubj).padStart(3,'0'); // pad 0's to subject number (enumerator_id)
    let idxs = [];
    let traj = [];
    let unique_id;
    let unique_id2;
    let filename_idx;
    let filename_traj;

    // order of conditions given subject number parity
    var cond_order;
    if (isubj % 2 == 1) {
      cond_order = [1,2,3,1,2,3]; // REF, VOL, UNP, REF, VOL, UNP
    } else {
      cond_order = [1,3,2,1,3,2]; // REF, UNP, VOL, REF, UNP, VOL
    }

    var filenames = fs.readdirSync(__dirname+'/public/csvs/'+subj_dir); // get filenames in subject CSV folder
    // find the unique_id and store it
    for await (var filename of filenames) {
      // this loop is to get the unique_id from either the idx_epi or traj CSV
      var slice_end = filename.length-4;
      if (filename.slice(0,7)=='idx_epi') {
          unique_id = filename.slice(8,slice_end);
          filename_idx = filename;
      } else if (filename.slice(0,4)=='traj') {
          unique_id2 = filename.slice(5,slice_end);
          filename_traj = filename;
      } else {
          console.error('Neither \'idx_epi\' nor \'traj\' files were found in the folder!');
      }
    }

    // make sure the unique_ids are the same between the two CSV files
    if (unique_id != unique_id2) {
      error('Unique IDs do not match between \'idx_epi\' nor \'traj\'!');
    }

    // parse block indices
    const fileStream_idx = fs.createReadStream(__dirname+'/public/csvs/'+subj_dir+'/'+filename_idx);
      // stream resource: https://areknawo.com/node-js-file-streams-explained/
    const lines_idx = readline.createInterface({
      input: fileStream_idx,
      crlfDelay: Infinity
      // Note: the crlfDelay option is to recognize all instances of CR LF ('\r\n') as a single line break.
    });
    // store block indices in array
    for await (const line of lines_idx) {
      idxs.push(line.split`,`.map(x=>+x));
    }
    // match the dimensions of idxs to the traj array
    idxs.unshift(idxs[0]); idxs.unshift(idxs[0]);
    idxs.push(idxs[idxs.length-1]); idxs.push(idxs[idxs.length-1]);

    // parse correct choice feedback values
    const fileStream_traj = fs.createReadStream(__dirname+'/public/csvs/'+subj_dir+'/'+filename_traj);
    const lines_traj = readline.createInterface({
      input: fileStream_traj,
      crlfDelay: Infinity
      // Note: the crlfDelay option is to recognize all instances of CR LF ('\r\n') as a single line break.
    });

    // store correct feedback values in array (values transformed from (0,1) to -> [1,99])
    for await (const line of lines_traj) {
      traj.push(line.split`,`.map(x=>+x).map(x => Math.round(x*100)));
    }

    // populate table
    for (let iblock=0; iblock<nblock; iblock++) {
      let cond_type = cond_types[cond_order[iblock]-1]; // condition type for given block

      for (let itrial=0; itrial<ntrial; itrial++) {
        // write out the query string
        let unique_id_str = '"'+unique_id+'"';
        let cond_type_str = '"'+cond_type+'"';
        query_str.push('INSERT INTO task_table (unique_id, cond, i_block, i_round, i_trial, correct_choice_feedback ) '+
                       'VALUES (' +unique_id_str+', '+
                                   cond_type_str+', '+
                                   (iblock+1)+', '+
                                   idxs[iblock][itrial]+', '+
                                   (itrial+1)+', '+
                                   traj[iblock][itrial]+');');
      } // end trial loop
    } // end block loop
  } // end subj loop
  return query_str;
} // end populate_task_table

};
