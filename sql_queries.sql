/* SQL queries to build the main experimental task database */

-- use tables within specified database
USE main_db;

-- create main_table
CREATE TABLE main_table(
  isubj INT NOT NULL,
  unique_id CHAR(13) NOT NULL,
  task_completion_flag BOOL,
  questionnaire_completion_flag BOOL,
  prolific_id CHAR(24),
  bonus_flag BOOL,                                    -- bonus payment for good performance //debug : new
  timestamp_init TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- time when entry was created
  timestamp_task_start TIMESTAMP NULL, -- time when prolific_id added
  timestamp_task_end TIMESTAMP NULL,   -- time when task finished
  timestamp_ques_start TIMESTAMP NULL, -- time when questionnaire started //debug : new
  timestamp_ques_end TIMESTAMP NULL,   -- time when questionnaire finished
  feedback TEXT,
  UNIQUE (prolific_id),
  PRIMARY KEY (unique_id) );

-- create task_table
CREATE TABLE task_table(
  unique_id CHAR(13),
  cond CHAR(3),
  i_block INT,
  i_round INT,
  i_trial INT,
  correct_choice_feedback INT );

-- create resp_table
CREATE TABLE resp_table(
  unique_id CHAR(13),
  cond CHAR(3),
  i_block INT,
  i_round INT,
  i_trial INT,
  seen_feedback INT,
  is_correct bool,
  choice_position CHAR(1),
  choice_symbol INT,
  reaction_time INT, -- assuming that RT values are in units of milliseconds
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- create ques_table
CREATE TABLE ques_table (
  unique_id CHAR(13),
  label VARCHAR(20),
  responses TEXT
);

-- populate main_table
  INSERT INTO main_table (isubj, unique_id)
    VALUES (     );

-- update main_table
  /* This query should be made when the subject enters their prolific_id at the beginning of the experiment */
  UPDATE main_table
    SET prolific_id = 'insert prolific_id here'
    WHERE unique_id = 'insert unique_id here';

  /* This query should be used when the subject has completed the main task */
  UPDATE main_table
    SET task_completion_flag = TRUE
    WHERE unique_id = 'insert unique_id here';

  /* This query should be used when the subject has completed the questionnaire */
  UPDATE main_table
    SET questionnaire_completion_flag = TRUE
    WHERE unique_id = 'insert unique_id here';

-- populate task_table
  /* Once task_table is populated, there should no longer be any reason to modify its contents */
  INSERT INTO traj_test (unique_id, cond, i_block, i_round, i_trial, correct_choice_feedback)
    VALUES (/* 'cond' can be calculated by the parity of 'isubj' and from 'i_block'
                Reference: var cond_order in exec_expe.js for more details */      );

-- query into the response table (from frontend)
  INSERT INTO resp_table (unique_id, cond, i_block, i_round, i_trial, seen_feedback, is_correct, choice_position, choice_symbol, reaction_time)
    VALUES (     );
