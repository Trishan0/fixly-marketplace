'use strict';

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../src/modules');
const requiredBounds = {
  'identity/repository.js': ['workerPortfolio', 'workerSkills', 'listWorkers', 'workerReviews', 'customerRecentJobs'],
  'marketplace/repository.js': ['listReceivedInvites', 'listCategories', 'listJobFeed', 'listCustomerJobs', 'listAssignedJobs', 'listAgentOpenJobs', 'listAgentOpenJobsForWorker', 'listJobProposals', 'listJobPhotos', 'workerEarnings'],
  'operations/repository.js': ['listNotifications', 'listMyReports', 'adminUsers', 'listAdminWorkers', 'listAdminJobs', 'listAdminReports', 'listCategoriesAdmin'],
  'agents/repository.js': ['runSteps', 'runRecommendations', 'history', 'candidateWorkers'],
};

function implementationFor(source, name) {
  const expression = new RegExp(`(?:async\\s+)?function\\s+${name}\\b`);
  const match = expression.exec(source);
  const start = match?.index ?? -1;
  if (start === -1) throw new Error(`Missing repository operation: ${name}`);
  const endMatch = /(?:async\s+)?function\s+/.exec(source.slice(start + match[0].length));
  const end = endMatch ? start + match[0].length + endMatch.index : -1;
  return source.slice(start, end === -1 ? undefined : end);
}

describe('repository list-query bounds', () => {
  test('applies a SQL LIMIT to every multi-record read model', () => {
    for (const [relativePath, operations] of Object.entries(requiredBounds)) {
      const source = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
      for (const operation of operations) {
        expect(implementationFor(source, operation)).toMatch(/\bLIMIT\b/);
      }
    }
  });
});
