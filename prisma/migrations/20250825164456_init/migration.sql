-- CreateTable
CREATE TABLE "public"."history" (
    "id" TEXT NOT NULL,
    "prompt_message" TEXT NOT NULL,
    "tags_id" TEXT,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."output_generate" (
    "id" TEXT NOT NULL,
    "history_id" TEXT NOT NULL,
    "prompt_image_url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "output_tags" TEXT NOT NULL,

    CONSTRAINT "output_generate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."history" ADD CONSTRAINT "history_tags_id_fkey" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."output_generate" ADD CONSTRAINT "output_generate_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "public"."history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
