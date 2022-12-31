import { CheckIcon, CloseIcon } from '@chakra-ui/icons';
import {
  Box,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

interface Props {
  displayPropertyName: string
  articles: Array<{
    propertyValue: string;
    passedFilters: boolean
  }>
}

export const ArticleFilterResultsTable = ({ articles, displayPropertyName }: Props) => {
  const { t } = useTranslation();

  return (
    <Box>

      <Box
        position="relative"
        border="solid 1px"
        borderColor="gray.600"
        borderRadius="md"
      >
        <Box
          maxHeight="sm"
          overflow="auto"
        >
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>
                    {displayPropertyName}
                  </Th>
                  <Th isNumeric>
                    {t('features.feedConnections.components'
                      + '.articleFilterResultsTable.columnHeaderPassedFilters')}
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {articles.map(({ passedFilters, propertyValue }) => (
                  <Tr key={propertyValue}>
                    <Td>{propertyValue}</Td>
                    <Td isNumeric>
                      {passedFilters
                        ? <CheckIcon color="green.500" />
                        : <CloseIcon color="red.500" />}

                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    </Box>
  );
};
