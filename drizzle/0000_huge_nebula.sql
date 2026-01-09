CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shopkeeper_id` integer,
	`motoboy_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`customer_name` text,
	`customer_phone` text,
	`address` text NOT NULL,
	`lat` real,
	`lng` real,
	`value` real DEFAULT 0,
	`fee` real DEFAULT 0,
	`observation` text,
	`stop_order` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`shopkeeper_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`motoboy_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `financial_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`category` text DEFAULT 'Geral',
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`max_motoboys` integer DEFAULT 1,
	`max_deliveries` integer DEFAULT 50,
	`price_per_extra_delivery` real DEFAULT 1,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `shop_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`remuneration_model` text DEFAULT 'fixed' NOT NULL,
	`fixed_value` real DEFAULT 0,
	`value_per_km` real DEFAULT 0,
	`daily_value` real DEFAULT 0,
	`guaranteed_minimum` real DEFAULT 0,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_settings_user_id_unique` ON `shop_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`asaas_customer_id` text,
	`asaas_subscription_id` text,
	`status` text DEFAULT 'active',
	`current_period_start` text,
	`current_period_end` text,
	`usage_count` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`related_delivery_id` integer,
	`creator_id` integer,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_delivery_id`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`role` text DEFAULT 'motoboy' NOT NULL,
	`password` text,
	`avatar_url` text,
	`last_avatar_update` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`subscription_status` text DEFAULT 'active' NOT NULL,
	`two_factor_secret` text,
	`two_factor_enabled` integer DEFAULT false,
	`current_lat` real,
	`current_lng` real,
	`last_location_update` text,
	`daily_goal` integer DEFAULT 10,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);