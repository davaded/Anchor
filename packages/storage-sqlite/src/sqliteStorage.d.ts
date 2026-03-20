import type { AnchorEvent, ArtifactMetadata, ProjectionSnapshot, TaskProjection } from "@anchor/core";
export declare class SqliteStorage {
    private readonly filePath;
    private readonly ready;
    private SQL;
    private db;
    constructor(filePath: string);
    append(events: AnchorEvent[]): Promise<void>;
    listEvents(taskId: string): Promise<AnchorEvent[]>;
    getSnapshot(taskId: string): Promise<ProjectionSnapshot | null>;
    listTasks(): Promise<TaskProjection[]>;
    rebuild(taskId: string): Promise<ProjectionSnapshot>;
    recordArtifact(metadata: ArtifactMetadata): Promise<void>;
    getArtifactMetadata(artifactId: string): Promise<ArtifactMetadata | null>;
    private initialize;
    private flush;
    private queryJson;
    private selectEvents;
    private buildSnapshot;
    private persistSnapshot;
    private replaceRows;
}
//# sourceMappingURL=sqliteStorage.d.ts.map