                    {/* Storage Analysis Section */}
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <HardDrive className="h-5 w-5" />
                          Storage Management
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Analyze storage usage, detect orphaned files from failed downloads, and
                          manage cached data.
                        </p>

                        {/* Analyze Button */}
                        {!storageAnalysis && (
                          <Button
                            variant="outline"
                            onClick={handleAnalyzeStorage}
                            disabled={isAnalyzingStorage}
                            className="w-full"
                          >
                            {isAnalyzingStorage ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Analyzing Storage...
                              </>
                            ) : (
                              <>
                                <HardDrive className="h-4 w-4 mr-2" />
                                Analyze Storage
                              </>
                            )}
                          </Button>
                        )}

                        {/* Storage Analysis Results */}
                        {storageAnalysis && (
                          <div className="space-y-3">
                            {/* Total Usage Summary */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                              <span className="text-sm font-medium">Total App Storage:</span>
                              <span className="text-sm font-mono">
                                {storageAnalysis.breakdownFormatted.total}
                              </span>
                            </div>

                            {/* Breakdown */}
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Model Cache (Filesystem):</span>
                                <span className="font-mono">
                                  {storageAnalysis.breakdownFormatted.filesystemData}
                                </span>
                              </div>
                              {storageAnalysis.breakdown.legacyCache > 0 && (
                                <div className="flex justify-between text-yellow-600 dark:text-yellow-400">
                                  <span>Legacy Cache (Browser):</span>
                                  <span className="font-mono">
                                    {storageAnalysis.breakdownFormatted.legacyCache}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* File List */}
                            {storageAnalysis.files.length > 0 && (
                              <div className="space-y-2 pt-3 border-t">
                                <span className="text-sm font-medium">Cached Files:</span>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {storageAnalysis.files.map((file) => (
                                    <div
                                      key={file.url}
                                      className="flex items-center justify-between p-2 bg-muted rounded text-xs"
                                    >
                                      <div className="flex-1 min-w-0 mr-2">
                                        <div className="truncate font-medium">{file.name}</div>
                                        <div className="text-muted-foreground">
                                          {file.sizeFormatted} • {file.lastModified}
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteFile(file)}
                                        disabled={isCleaningStorage}
                                        className="shrink-0"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Orphaned Files Warning */}
                            {storageAnalysis.orphanedFiles.length > 0 && (
                              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded space-y-2">
                                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="font-medium">
                                    Found {storageAnalysis.orphanedFiles.length} orphaned files (
                                    {storageAnalysis.orphanedSizeFormatted})
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  These are incomplete downloads or corrupted files without metadata.
                                  Safe to delete.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCleanupOrphans}
                                  disabled={isCleaningStorage}
                                  className="w-full"
                                >
                                  {isCleaningStorage ? 'Cleaning...' : 'Clean Up Orphaned Files'}
                                </Button>
                              </div>
                            )}

                            {/* Legacy Cache Warning */}
                            {storageAnalysis.breakdown.legacyCache > 0 && (
                              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded space-y-2">
                                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                                  <Info className="h-4 w-4" />
                                  <span className="font-medium">
                                    Legacy cache detected (
                                    {storageAnalysis.breakdownFormatted.legacyCache})
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Old cached data from previous app version. Safe to delete.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleClearLegacyCache}
                                  disabled={isCleaningStorage}
                                  className="w-full"
                                >
                                  {isCleaningStorage ? 'Clearing...' : 'Clear Legacy Cache'}
                                </Button>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-3 border-t">
                              <Button
                                variant="outline"
                                onClick={handleAnalyzeStorage}
                                disabled={isAnalyzingStorage}
                                className="flex-1"
                              >
                                {isAnalyzingStorage ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Analyzing...
                                  </>
                                ) : (
                                  'Refresh'
                                )}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={handleClearAllStorage}
                                disabled={isCleaningStorage || storageAnalysis.breakdown.total === 0}
                                className="flex-1"
                              >
                                {isCleaningStorage ? 'Clearing...' : 'Clear All'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
