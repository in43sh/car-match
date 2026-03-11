CREATE TABLE `carfax_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer,
	`carfax_url` text NOT NULL,
	`accident_count` integer,
	`owner_count` integer,
	`title_issues` text,
	`odometer_rollback` integer,
	`last_odometer` integer,
	`raw_summary` text,
	`verdict` text DEFAULT 'unknown' NOT NULL,
	`verdict_reasons` text,
	`parsed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fb_listing_id` text NOT NULL,
	`profile_id` integer,
	`title` text NOT NULL,
	`price` integer,
	`mileage` integer,
	`year` integer,
	`location` text,
	`fb_url` text NOT NULL,
	`image_url` text,
	`seller_type` text,
	`status` text DEFAULT 'new' NOT NULL,
	`alerted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `search_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_fb_listing_id_unique` ON `listings` (`fb_listing_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `listings_fb_listing_id_idx` ON `listings` (`fb_listing_id`);--> statement-breakpoint
CREATE INDEX `listings_status_idx` ON `listings` (`status`);--> statement-breakpoint
CREATE TABLE `search_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`make` text,
	`model` text,
	`min_year` integer,
	`max_price` integer,
	`max_mileage` integer,
	`location` text NOT NULL,
	`radius_miles` integer DEFAULT 50 NOT NULL,
	`include_private` integer DEFAULT true NOT NULL,
	`include_dealers` integer DEFAULT true NOT NULL,
	`japanese_only` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
