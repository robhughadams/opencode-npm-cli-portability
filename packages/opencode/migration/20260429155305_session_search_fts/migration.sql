CREATE INDEX `session_project_time_updated_id_idx` ON `session` (`project_id`,`time_updated`,`id`);--> statement-breakpoint
CREATE INDEX `session_directory_time_updated_id_idx` ON `session` (`directory`,`time_updated`,`id`);--> statement-breakpoint
CREATE INDEX `session_path_time_updated_id_idx` ON `session` (`path`,`time_updated`,`id`);--> statement-breakpoint
CREATE INDEX `session_archived_time_updated_id_idx` ON `session` (`time_archived`,`time_updated`,`id`);--> statement-breakpoint
CREATE VIRTUAL TABLE `session_title_fts` USING fts5(`session_id` UNINDEXED, `title`, tokenize = 'unicode61');--> statement-breakpoint
INSERT INTO `session_title_fts` (`session_id`, `title`) SELECT `id`, `title` FROM `session`;--> statement-breakpoint
CREATE TRIGGER `session_title_fts_insert` AFTER INSERT ON `session` BEGIN
  INSERT INTO `session_title_fts` (`session_id`, `title`) VALUES (new.`id`, new.`title`);
END;--> statement-breakpoint
CREATE TRIGGER `session_title_fts_update` AFTER UPDATE OF `title` ON `session` BEGIN
  DELETE FROM `session_title_fts` WHERE `session_id` = old.`id`;
  INSERT INTO `session_title_fts` (`session_id`, `title`) VALUES (new.`id`, new.`title`);
END;--> statement-breakpoint
CREATE TRIGGER `session_title_fts_delete` AFTER DELETE ON `session` BEGIN
  DELETE FROM `session_title_fts` WHERE `session_id` = old.`id`;
END;
