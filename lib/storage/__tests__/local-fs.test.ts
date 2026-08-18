import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { LocalFsStorageDriver } from "@/lib/storage/local-fs";

describe("LocalFsStorageDriver", () => {
  const driver = new LocalFsStorageDriver();
  const testDir = randomUUID();

  afterAll(async () => {
    await rm(resolve(process.cwd(), ".storage-local", testDir), {
      recursive: true,
      force: true,
    });
  });

  it("round-trips a written object", async () => {
    const key = `${testDir}/hello.txt`;
    const body = Buffer.from("hello world");

    const stored = await driver.put(key, body);
    expect(stored.size).toBe(body.byteLength);

    const read = await driver.get(key);
    expect(read.equals(body)).toBe(true);
  });

  it("throws NotFoundError for a key that was never written", async () => {
    await expect(driver.get(`${testDir}/does-not-exist.txt`)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("refuses a key that attempts to traverse outside the storage root", async () => {
    await expect(driver.get("../../etc/passwd")).rejects.toThrow(NotFoundError);
  });

  it("list() finds every key under a prefix, including nested subdirectories", async () => {
    await driver.put(`${testDir}/list/a.txt`, Buffer.from("a"));
    await driver.put(`${testDir}/list/nested/b.txt`, Buffer.from("b"));

    const keys = await driver.list(`${testDir}/list`);
    expect(keys.sort()).toEqual(
      [`${testDir}/list/a.txt`, `${testDir}/list/nested/b.txt`].sort(),
    );
  });

  it("list() returns an empty array for a prefix that does not exist", async () => {
    expect(await driver.list(`${testDir}/never-written`)).toEqual([]);
  });

  it("delete() removes a written object", async () => {
    const key = `${testDir}/to-delete.txt`;
    await driver.put(key, Buffer.from("bye"));
    await driver.delete(key);
    await expect(driver.get(key)).rejects.toThrow(NotFoundError);
  });

  it("delete() on a nonexistent key does not throw", async () => {
    await expect(
      driver.delete(`${testDir}/never-existed.txt`),
    ).resolves.toBeUndefined();
  });
});
